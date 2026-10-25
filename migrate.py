import os
import json
import sqlite3
import chromadb
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
CHROMA_PATH = BASE_DIR / "chroma_db"
SQLITE_PATH = BASE_DIR / "nutrition-bot.db"

def migrate():
    # Connect to SQLite
    conn = sqlite3.connect(SQLITE_PATH)
    cursor = conn.cursor()
    
    # Connect to Chroma
    print("Loading Chroma DB...")
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    collection = client.get_collection(name="nutrition_chunks")
    
    print("Fetching all chunks from Chroma...")
    results = collection.get(include=["documents", "metadatas", "embeddings"])
    
    ids = results["ids"]
    docs = results["documents"]
    metas = results["metadatas"]
    embeds = results["embeddings"]
    
    print(f"Found {len(ids)} chunks. Migrating to SQLite...")
    
    count = 0
    for i in range(len(ids)):
        chunk_id = ids[i]
        content = docs[i]
        meta = metas[i]
        embedding_list = embeds[i].tolist() if hasattr(embeds[i], 'tolist') else embeds[i]
        embedding_json = json.dumps(embedding_list)
        
        # Ensure the document exists in SQLite
        doc_id = meta["doc_id"]
        cursor.execute("SELECT doc_id FROM documents WHERE doc_id = ?", (doc_id,))
        if not cursor.fetchone():
            # Insert dummy document meta if it doesn't exist (though it should)
            print(f"Warning: Document {doc_id} not in SQLite. Skipping chunk.")
            continue
            
        cursor.execute("""
            INSERT OR REPLACE INTO chunks 
            (id, doc_id, document_name, publisher, year, section_heading, content, chunk_index, token_count, embedding)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            chunk_id,
            doc_id,
            meta["document_name"],
            meta["publisher"],
            meta["year"],
            meta["section_heading"],
            content,
            meta["chunk_index"],
            0, # token_count isn't strictly needed for retrieval
            embedding_json
        ))
        count += 1
        
    conn.commit()
    conn.close()
    print(f"Successfully migrated {count} chunks to SQLite!")

if __name__ == "__main__":
    migrate()
