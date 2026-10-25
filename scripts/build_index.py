import os
import json
from pathlib import Path
import tiktoken
import chromadb

# Setup paths
BASE_DIR = Path(__file__).resolve().parent.parent
PARSED_DIR = BASE_DIR / "corpus" / "parsed"
META_PATH = BASE_DIR / "corpus" / "metadata.json"

# Setup chunking parameters
MAX_CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
MIN_CHUNK_SIZE = 50

enc = tiktoken.get_encoding("cl100k_base")

def token_count(text):
    return len(enc.encode(text))

def token_split(text, max_size, overlap):
    tokens = enc.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + max_size, len(tokens))
        chunks.append(enc.decode(tokens[start:end]))
        start += max_size - overlap
    return chunks

def split_into_chunks(text, heading):
    """Splits text recursively by paragraphs, then lines, then tokens."""
    if token_count(text) <= MAX_CHUNK_SIZE:
        return [text]
        
    paragraphs = text.split('\n\n')
    
    if len(paragraphs) == 1:
        lines = text.split('\n')
        if len(lines) == 1:
            return token_split(text, MAX_CHUNK_SIZE, CHUNK_OVERLAP)
        blocks = lines
        join_char = '\n'
    else:
        blocks = paragraphs
        join_char = '\n\n'
        
    chunks = []
    current_chunk = []
    current_length = 0
    
    for block in blocks:
        block_len = token_count(block)
        
        if block_len > MAX_CHUNK_SIZE:
            if current_chunk:
                chunks.append(join_char.join(current_chunk))
                current_chunk = []
                current_length = 0
            
            sub_chunks = split_into_chunks(block, heading)
            chunks.extend(sub_chunks)
            continue
            
        if current_length + block_len > MAX_CHUNK_SIZE and current_chunk:
            chunks.append(join_char.join(current_chunk))
            # Overlap: keep the last block
            current_chunk = [current_chunk[-1]] if current_chunk else []
            current_length = token_count(current_chunk[0]) if current_chunk else 0
            
        current_chunk.append(block)
        current_length += block_len
        
    if current_chunk:
        chunks.append(join_char.join(current_chunk))
        
    return chunks

def extract_sections(text):
    """Splits text into sections based on '## ' headers."""
    sections = []
    lines = text.split('\n')
    current_heading = "General"
    current_content = []
    
    import re
    for line in lines:
        if re.match(r'^#{1,6}\s', line):
            if current_content:
                sections.append((current_heading, '\n'.join(current_content)))
            # Extract heading text by stripping the `#` and whitespace
            current_heading = re.sub(r'^#{1,6}\s+', '', line).strip()
            current_content = []
        else:
            current_content.append(line)
            
    if current_content:
        sections.append((current_heading, '\n'.join(current_content)))
        
    return sections

def process_document(doc_meta):
    doc_id = doc_meta["doc_id"]
    filepath = PARSED_DIR / f"{doc_id}.txt"
    if not filepath.exists():
        return []
        
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()
        
    sections = extract_sections(text)
    doc_chunks = []
    chunk_idx = 0
    
    for heading, content in sections:
        content = content.strip()
        if not content:
            continue
            
        if token_count(content) <= MAX_CHUNK_SIZE:
            doc_chunks.append({
                "doc_id": doc_id,
                "document_name": doc_meta["document_name"],
                "publisher": doc_meta["publisher"],
                "year": doc_meta["year"],
                "section_heading": heading,
                "content": content,
                "chunk_index": chunk_idx,
                "token_count": token_count(content)
            })
            chunk_idx += 1
        else:
            sub_chunks = split_into_chunks(content, heading)
            for sub in sub_chunks:
                doc_chunks.append({
                    "doc_id": doc_id,
                    "document_name": doc_meta["document_name"],
                    "publisher": doc_meta["publisher"],
                    "year": doc_meta["year"],
                    "section_heading": heading,
                    "content": sub,
                    "chunk_index": chunk_idx,
                    "token_count": token_count(sub)
                })
                chunk_idx += 1
                
    return doc_chunks

def embed_and_save(chunks):
    if not chunks:
        return
        
    import uuid
    from sentence_transformers import SentenceTransformer
    
    # 1. Initialize embedding model (supports 8192 tokens)
    print("Loading embedding model (this may take a moment)...")
    model = SentenceTransformer("jinaai/jina-embeddings-v2-small-en", trust_remote_code=True)
    # Prevent the model from padding/computing attention up to 8192 tokens to save RAM!
    model.max_seq_length = 1024 
    
    # 2. Initialize Chroma DB client
    client = chromadb.PersistentClient(path=str(BASE_DIR / "chroma_db"))
    collection = client.get_or_create_collection(
        name="nutrition_chunks",
        metadata={"hnsw:space": "cosine"},  # cosine is correct for normalized sentence embeddings
    )
    
    batch_size = 100
    
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        print(f"Embedding batch {i // batch_size + 1} / {len(chunks) // batch_size + 1}...")
        
        ids = [str(uuid.uuid4()) for _ in batch]
        documents = [c["content"] for c in batch]
        metadatas = [{
            "doc_id": c["doc_id"],
            "document_name": c["document_name"],
            "publisher": c["publisher"],
            "year": c["year"],
            "section_heading": c["section_heading"],
            "chunk_index": c["chunk_index"]
        } for c in batch]
        
        # Generate explicit embeddings to bypass Chroma's default model limit
        # Use small batch_size to prevent CPU OOM on large attention matrices
        embeddings = model.encode(documents, batch_size=16).tolist()
        
        collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )

if __name__ == "__main__":
    with open(META_PATH) as f:
        metadata = json.load(f)
        
    all_chunks = []
    print("Chunking documents...")
    for doc in metadata:
        chunks = process_document(doc)
        all_chunks.extend(chunks)
        print(f"  {doc['doc_id']}: {len(chunks)} chunks")
        
    print(f"\nTotal chunks: {len(all_chunks)}")
    
    print("\nConnecting to Chroma DB and clearing old collection...")
    client = chromadb.PersistentClient(path=str(BASE_DIR / "chroma_db"))
    try:
        client.delete_collection("nutrition_chunks")
    except Exception:
        pass
    
    print("Embedding and indexing...")
    embed_and_save(all_chunks)
    print("✅ Successfully built local Chroma DB vector index!")
