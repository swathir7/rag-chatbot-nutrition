import os
import requests
from pathlib import Path

DOWNLOADS = {
    "usda-dietary-guidelines.pdf": "https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf",
    "who-healthy-diet.html": "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
    "uk-eatwell-guide.pdf": "https://assets.publishing.service.gov.uk/media/5a7f23be40f0b6230268ec3b/Eatwell_guide_colour.pdf",
    "efsa-drv-summary.pdf": "https://efsa.onlinelibrary.wiley.com/doi/pdfdirect/10.2903/sp.efsa.2017.e15121?download=true",
    "foodsafety-cold-storage.html": "https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts",
    "au-dietary-guidelines.pdf": "https://www.eatforhealth.gov.au/sites/default/files/2022-09/n55_australian_dietary_guidelines.pdf",
    "fda-food-code.pdf": "https://www.fda.gov/media/164311/download?attachment"
}

RAW_DIR = Path(__file__).resolve().parent.parent / "corpus" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

for filename, url in DOWNLOADS.items():
    dest = RAW_DIR / filename
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"✅ Already exists: {filename}")
        continue
        
    print(f"Downloading {filename}...")
    try:
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()
        
        with open(dest, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        print(f"✅ Downloaded {filename} ({dest.stat().st_size / 1024 / 1024:.2f} MB)")
    except Exception as e:
        print(f"❌ Failed to download {filename}: {e}")
