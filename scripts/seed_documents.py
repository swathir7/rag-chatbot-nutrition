"""
Seed the SQLite 'documents' table from corpus/metadata.json.

Usage:
  python scripts/seed_documents.py
"""

import json
import sqlite3
from datetime import date
from pathlib import Path

# Load metadata
metadata_path = Path(__file__).resolve().parent.parent / "corpus" / "metadata.json"
with open(metadata_path) as f:
    docs = json.load(f)

db_path = Path(__file__).resolve().parent.parent / "nutrition-bot.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Ensure table exists (in case app hasn't run yet)
cursor.execute("""
CREATE TABLE IF NOT EXISTS documents (
  doc_id          TEXT PRIMARY KEY,
  document_name   TEXT NOT NULL,
  publisher       TEXT NOT NULL,
  year            INTEGER NOT NULL,
  source_url      TEXT NOT NULL,
  retrieval_date  TEXT NOT NULL,
  doc_type        TEXT CHECK (doc_type IN ('nutrition', 'food_safety'))
)
""")

print(f"Seeding {len(docs)} documents into SQLite...\n")

for doc in docs:
    cursor.execute("""
    INSERT INTO documents (doc_id, document_name, publisher, year, source_url, retrieval_date, doc_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(doc_id) DO UPDATE SET
        document_name = excluded.document_name,
        publisher = excluded.publisher,
        year = excluded.year,
        source_url = excluded.source_url,
        retrieval_date = excluded.retrieval_date,
        doc_type = excluded.doc_type
    """, (
        doc["doc_id"],
        doc["document_name"],
        doc["publisher"],
        doc["year"],
        doc["source_url"],
        date.today().isoformat(),
        doc["doc_type"]
    ))
    print(f"  ✅ {doc['doc_id']}: {doc['document_name']}")

conn.commit()
print(f"\n✅ Done! {len(docs)} documents seeded.")

cursor.execute("SELECT COUNT(*) FROM documents")
count = cursor.fetchone()[0]
print(f"   Documents in table: {count}")

conn.close()
