import os
import chromadb
from pathlib import Path
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).resolve().parent.parent

def main():
    print("Loading embedding model...")
    model = SentenceTransformer("jinaai/jina-embeddings-v2-small-en", trust_remote_code=True)
    
    print("Connecting to Chroma DB...")
    client = chromadb.PersistentClient(path=str(BASE_DIR / "chroma_db"))
    
    try:
        collection = client.get_collection(name="nutrition_chunks")
    except Exception as e:
        print("Collection 'nutrition_chunks' not found. Please run build_index.py first.")
        return
        
    print(f"Index contains {collection.count()} chunks.\n")
    
    test_queries = [
        "How much protein does an adult need per day?",
        "How long can I store cooked chicken in the fridge?",
        "What is a healthy diet according to WHO?",
        "Are there specific food safety rules for pregnant women?",
        "What temperature should chicken be cooked to?"
    ]
    
    for query in test_queries:
        print("==================================================")
        print(f"QUERY: {query}")
        print("==================================================")
        
        query_embedding = model.encode([query]).tolist()
        
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=3
        )
        
        if not results['documents'] or not results['documents'][0]:
            print("No results found.\n")
            continue
            
        for i in range(len(results['documents'][0])):
            doc_content = results['documents'][0][i]
            meta = results['metadatas'][0][i]
            distance = results['distances'][0][i]
            
            print(f"\n[Result {i+1}] - Distance: {distance:.4f}")
            print(f"Source: {meta.get('document_name', 'Unknown')} ({meta.get('publisher', '')}, {meta.get('year', '')})")
            print(f"Section: {meta.get('section_heading', 'Unknown')}")
            # Print first 200 chars
            preview = doc_content[:200].replace('\n', ' ') + '...' if len(doc_content) > 200 else doc_content.replace('\n', ' ')
            print(f"Content Preview: {preview}\n")

if __name__ == "__main__":
    main()
