import os
import json
import sqlite3
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent
SAKSHAM_FILE = BASE_DIR / "corpus" / "raw" / "Additional Data" / "Saksham's file"
PARSED_DIR = BASE_DIR / "corpus" / "parsed"
DB_PATH = BASE_DIR / "nutrition-bot.db"

def process_saksham_data():
    if not SAKSHAM_FILE.exists():
        print(f"File not found: {SAKSHAM_FILE}")
        return

    docs = {}
    
    with open(SAKSHAM_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            data = json.loads(line)
            doc_id = data.get("document_id")
            if not doc_id:
                continue
                
            if doc_id not in docs:
                docs[doc_id] = []
                
            docs[doc_id].append(data)
            
    print(f"Found {len(docs)} documents in Saksham's data.")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    for doc_id, items in docs.items():
        # Sort by ordinal just in case
        items.sort(key=lambda x: x.get("ordinal", 0))
        
        md_lines = []
        for item in items:
            item_type = item.get("type")
            text = item.get("text", "")
            
            if item_type == "heading":
                level = item.get("level", 2)
                md_lines.append(f"\n{'#' * level} {text}\n")
            elif item_type == "list_item":
                md_lines.append(f"- {text}")
            elif item_type == "table":
                md_lines.append(f"\n{text}\n")
            else:
                # paragraphs
                md_lines.append(f"{text}\n")
                
        full_md = "\n".join(md_lines)
        
        out_path = PARSED_DIR / f"{doc_id}.txt"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(full_md)
            
        print(f"✅ Saved {out_path.name} ({len(full_md)} chars)")
        
        # Ensure it exists in the documents table
        # We will create a basic metadata entry for it if it doesn't exist
        cursor.execute("SELECT doc_id FROM documents WHERE doc_id = ?", (doc_id,))
        if not cursor.fetchone():
            document_name = doc_id.replace("-", " ").title()
            cursor.execute("""
                INSERT INTO documents (doc_id, document_name, publisher, year, source_url, retrieval_date, doc_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (doc_id, document_name, "Saksham Research", 2024, "local-jsonl", datetime.now().isoformat(), "nutrition"))
            print(f"  Added {doc_id} to SQLite 'documents' table.")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    process_saksham_data()
