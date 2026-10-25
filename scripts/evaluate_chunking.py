import os
import json
import re
from pathlib import Path
import tiktoken
import math

BASE_DIR = Path(__file__).resolve().parent.parent
PARSED_DIR = BASE_DIR / "corpus" / "parsed"
EVAL_RESULTS_DIR = BASE_DIR / "eval" / "results"

MAX_CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
MIN_CHUNK_SIZE = 50

enc = tiktoken.get_encoding("cl100k_base")

def token_count(text):
    return len(enc.encode(text))

def extract_sections(text):
    sections = []
    lines = text.split('\n')
    current_heading = "General"
    current_content = []
    
    for line in lines:
        if re.match(r'^#{1,6}\s', line):
            if current_content:
                sections.append((current_heading, '\n'.join(current_content)))
            current_heading = re.sub(r'^#{1,6}\s+', '', line).strip()
            current_content = []
        else:
            current_content.append(line)
            
    if current_content:
        sections.append((current_heading, '\n'.join(current_content)))
        
    return sections

def split_into_chunks(text, heading):
    tokens = enc.encode(text)
    if len(tokens) <= MAX_CHUNK_SIZE:
        return [text]
        
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + MAX_CHUNK_SIZE, len(tokens))
        chunk_text = enc.decode(tokens[start:end])
        
        if len(tokens) - start < MIN_CHUNK_SIZE and start != 0:
            pass
            
        chunks.append(chunk_text)
        start += MAX_CHUNK_SIZE - CHUNK_OVERLAP
        
    return chunks

def evaluate():
    all_chunk_sizes = []
    clean_fit_count = 0
    fallback_split_count = 0
    doc_stats = {}
    
    for filepath in PARSED_DIR.glob("*.txt"):
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()
            
        sections = extract_sections(text)
        doc_name = filepath.name
        doc_stats[doc_name] = {'chunks': 0, 'tokens': []}
        
        for heading, content in sections:
            content = content.strip()
            if not content:
                continue
                
            tokens = token_count(content)
            if tokens <= MAX_CHUNK_SIZE:
                all_chunk_sizes.append(tokens)
                doc_stats[doc_name]['chunks'] += 1
                doc_stats[doc_name]['tokens'].append(tokens)
                clean_fit_count += 1
            else:
                sub_chunks = split_into_chunks(content, heading)
                for sub in sub_chunks:
                    t = token_count(sub)
                    all_chunk_sizes.append(t)
                    doc_stats[doc_name]['chunks'] += 1
                    doc_stats[doc_name]['tokens'].append(t)
                    fallback_split_count += 1
                    
    # Math stats
    sizes = sorted(all_chunk_sizes)
    n = len(sizes)
    if n == 0:
        print("No chunks generated")
        return
        
    mean_val = sum(sizes) / n
    variance = sum((x - mean_val) ** 2 for x in sizes) / n
    std_dev = math.sqrt(variance)
    median_val = sizes[n // 2] if n % 2 != 0 else (sizes[n // 2 - 1] + sizes[n // 2]) / 2.0
    p90_idx = int(n * 0.90)
    p90_val = sizes[p90_idx] if p90_idx < n else sizes[-1]
    
    report = []
    report.append("# Chunking Strategy Mathematical Evaluation")
    report.append("## Global Metrics")
    report.append(f"- **Total Documents Parsed:** {len(doc_stats)}")
    report.append(f"- **Total Chunks Generated:** {n}")
    report.append(f"- **Clean Semantic Fits (<=800 tokens):** {clean_fit_count} ({clean_fit_count/n*100:.1f}%)")
    report.append(f"- **Fallback Splits (forced break):** {fallback_split_count} ({fallback_split_count/n*100:.1f}%)")
    report.append("")
    report.append("## Token Distribution")
    report.append(f"- **Minimum Size:** {sizes[0]} tokens")
    report.append(f"- **Maximum Size:** {sizes[-1]} tokens")
    report.append(f"- **Average (Mean) Size:** {mean_val:.1f} tokens")
    report.append(f"- **Median Size:** {median_val} tokens")
    report.append(f"- **Standard Deviation:** {std_dev:.1f} tokens")
    report.append(f"- **90th Percentile:** {p90_val} tokens")
    
    report.append("")
    report.append("## Document-Level Breakdown (Top 10 largest)")
    sorted_docs = sorted(doc_stats.items(), key=lambda x: x[1]['chunks'], reverse=True)
    report.append("| Document | Total Chunks | Avg Tokens/Chunk | Max Tokens |")
    report.append("|----------|--------------|------------------|------------|")
    for doc, stats in sorted_docs[:10]:
        avg = sum(stats['tokens']) / len(stats['tokens']) if stats['tokens'] else 0
        mx = max(stats['tokens']) if stats['tokens'] else 0
        report.append(f"| {doc} | {stats['chunks']} | {avg:.1f} | {mx} |")
        
    os.makedirs(EVAL_RESULTS_DIR, exist_ok=True)
    out_path = EVAL_RESULTS_DIR / "chunking_evaluation.md"
    with open(out_path, "w") as f:
        f.write('\n'.join(report))
        
    print(f"Evaluation complete. Report saved to {out_path}")

if __name__ == "__main__":
    evaluate()
