import os
import json
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent.parent / "corpus" / "raw"
META_PATH = Path(__file__).resolve().parent.parent / "corpus" / "metadata.json"

docs = []

for file in RAW_DIR.glob("*"):
    if file.name.startswith("."):
        continue
        
    filename = file.name
    
    # Defaults
    doc_id = file.stem.lower().replace(" ", "-").replace("_", "-").replace("---", "-").strip("-")
    document_name = file.stem.replace("_", "-").strip()
    publisher = "Unknown"
    year = 2024
    source_url = "local-upload"
    doc_type = "nutrition"
    
    if "FoodSafety.gov" in filename:
        document_name = document_name.split("- FoodSafety.gov")[0].strip()
        publisher = "FoodSafety.gov"
        doc_type = "food_safety"
        
    elif "EFSA" in filename:
        document_name = "Dietary Reference Values for Nutrients - Summary Report"
        publisher = "European Food Safety Authority (EFSA)"
        year = 2017
        
    elif "n55_australian_dietary" in filename:
        document_name = "Australian Dietary Guidelines"
        publisher = "NHMRC"
        year = 2013
        
    elif "eatwell" in filename:
        document_name = "The Eatwell Guide"
        publisher = "Public Health England"
        year = 2016
        
    elif "who-healthy-diet" in filename:
        document_name = "Healthy Diet Fact Sheet"
        publisher = "World Health Organization (WHO)"
        year = 2024
        
    docs.append({
        "doc_id": doc_id,
        "document_name": document_name,
        "publisher": publisher,
        "year": year,
        "source_url": source_url,
        "doc_type": doc_type,
        "filename": filename
    })

with open(META_PATH, "w", encoding="utf-8") as f:
    json.dump(docs, f, indent=2)

print(f"Generated metadata for {len(docs)} documents.")
