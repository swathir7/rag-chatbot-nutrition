import os
import re
from pathlib import Path
from bs4 import BeautifulSoup

try:
    import pymupdf4llm
except ImportError:
    print("Please install pymupdf4llm: python3 -m pip install pymupdf4llm")
    exit(1)

RAW_DIR = Path(__file__).resolve().parent.parent / "corpus" / "raw"
PARSED_DIR = Path(__file__).resolve().parent.parent / "corpus" / "parsed"
PARSED_DIR.mkdir(parents=True, exist_ok=True)

# Sections to exclude (e.g., tables of contents, references, etc.)
EXCLUDE_HEADERS_REGEX = re.compile(
    r"^(?:\d+\.?\s*)?(?:table of contents|contents|references|bibliography|index|glossary|appendices|appendix|acknowledgements)\s*$", 
    re.IGNORECASE
)

def filter_markdown(text):
    """
    Filters out unwanted sections from the markdown.
    If it hits an excluded header, it drops all text until the next valid header.
    """
    lines = text.split('\n')
    filtered_lines = []
    skip_mode = False
    
    for line in lines:
        # Check if the line is a header
        header_match = re.match(r"^(#+)\s+(.+)", line)
        if header_match:
            level = len(header_match.group(1))
            header_text = header_match.group(2).strip()
            
            # If the header is one of our excluded sections, start skipping
            if EXCLUDE_HEADERS_REGEX.match(header_text):
                skip_mode = True
                continue
            # If we hit a new level 1 or 2 header that IS NOT excluded, stop skipping
            elif level <= 2:
                skip_mode = False
                
        if not skip_mode:
            filtered_lines.append(line)
            
    # Also do a quick cleanup of repetitive newline blocks
    result = '\n'.join(filtered_lines)
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result.strip()

def parse_pdf(filepath):
    print(f"  Converting {filepath.name} to markdown with pymupdf4llm...")
    md_text = pymupdf4llm.to_markdown(str(filepath))
    return filter_markdown(md_text)

def parse_html(filepath):
    print(f"  Parsing {filepath.name} with BeautifulSoup...")
    with open(filepath, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")
        
    # Remove script, style, nav, footer, and interactive elements
    for el in soup(["script", "style", "nav", "footer", "header", "aside", "form", "button"]):
        el.decompose()
        
    output = []
    for tag in soup.find_all(['h1', 'h2', 'h3', 'p', 'li', 'table']):
        if tag.name == 'table':
            # Simple table to text serialization
            rows = tag.find_all('tr')
            for row in rows:
                cols = [c.get_text(strip=True) for c in row.find_all(['td', 'th'])]
                output.append(" | ".join(cols))
            output.append("\n")
            continue
            
        text = tag.get_text(strip=True)
        if not text:
            continue
            
        if tag.name in ['h1', 'h2', 'h3']:
            output.append(f"\n{'#' * int(tag.name[1])} {text}\n")
        elif tag.name == 'li':
            output.append(f"- {text}")
        else:
            output.append(text)
            
    raw_md = "\n".join(output)
    return filter_markdown(raw_md)

if __name__ == "__main__":
    for file in RAW_DIR.glob("*"):
        if file.suffix not in ['.pdf', '.html'] or file.name.startswith("."):
            continue
            
        print(f"\nProcessing {file.name}...")
        
        doc_id = file.stem.lower().replace(" ", "-").replace("_", "-").replace("---", "-").strip("-")
        
        try:
            if file.suffix == '.pdf':
                parsed_text = parse_pdf(file)
            elif file.suffix == '.html':
                parsed_text = parse_html(file)
                
            out_path = PARSED_DIR / f"{doc_id}.txt"
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(parsed_text)
                
            print(f"  ✅ Saved {out_path.name} ({len(parsed_text)} chars)")
        except Exception as e:
            print(f"  ❌ Failed to parse {file.name}: {e}")

    print("\n✅ Parsing complete!")
