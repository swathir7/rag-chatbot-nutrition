// lib/retriever.ts
// Phase 4 — Retrieval Module
// Handles: query embedding → vector search → metadata-rich results
//
// Embedding: runs jinaai/jina-embeddings-v2-small-en locally via
//   @huggingface/transformers (ONNX) — SAME model used during indexing.
//   No API key required. Model is downloaded once and cached.
// Vector search: cosine similarity against SQLite-stored embeddings
// Metadata enrichment: SQLite documents table (via db.ts)

import { getDocumentByDocId, getAllChunks } from "./db";

export interface RetrievalOptions {
  query: string;
  k?: number;                        // default: 6
  filter?: { doc_id: string };       // optional per-document filter
}

export interface RetrievedChunk {
  chunk_id: string;
  doc_id: string;
  content: string;
  document_name: string;
  publisher: string;
  year: number;
  section_heading: string;
  source_url: string;
  similarity_score: number;
}

// ── 1. Local Query Embedding via @huggingface/transformers ───────────────────

// Lazy-loaded pipeline — downloads the ONNX model on first use, then cached
let _pipelinePromise: Promise<any> | null = null;

function getEmbeddingPipeline(): Promise<any> {
  if (!_pipelinePromise) {
    _pipelinePromise = (async () => {
      // Dynamic import to avoid issues with Next.js bundling
      const { pipeline } = await import("@huggingface/transformers");
      console.log("[retriever] Loading local Jina embedding model (first time may download ~130 MB)...");
      const extractor = await pipeline(
        "feature-extraction",
        "Xenova/jina-embeddings-v2-small-en",
        { dtype: "fp32" }
      );
      console.log("[retriever] Jina embedding model loaded successfully.");
      return extractor;
    })();
  }
  return _pipelinePromise;
}

async function embedQuery(text: string): Promise<number[]> {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });
  // output.tolist() returns [[...embedding...]] for a single input
  const list = output.tolist();
  return Array.isArray(list[0]) ? list[0] : list;
}

// ── 2. Cosine similarity ────────────────────────────────────────────────────

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── 3. Main retrieval function ───────────────────────────────────────────────

export async function retrieveChunks(
  options: RetrievalOptions
): Promise<RetrievedChunk[]> {
  // Step 1: embed the query with the same model used during indexing
  const queryEmbedding = await embedQuery(options.query);

  // Step 2: Fetch all chunks from SQLite and compute similarity locally
  // This bypasses the need for Chroma DB (and avoids AVX instruction segfaults on cheap cloud CPUs)
  const allChunks = getAllChunks() as any[];
  
  let scoredChunks = allChunks.map((chunk) => {
    // Parse the stored JSON array embedding
    const chunkEmbedding = JSON.parse(chunk.embedding);
    const score = cosineSimilarity(queryEmbedding, chunkEmbedding);
    return { ...chunk, score };
  });

  // Apply optional filtering
  if (options.filter?.doc_id) {
    scoredChunks = scoredChunks.filter(c => c.doc_id === options.filter!.doc_id);
  }

  // Sort by highest score descending
  scoredChunks.sort((a, b) => b.score - a.score);

  // Take top K
  const topK = scoredChunks.slice(0, options.k ?? 6);

  // Step 3: return results enriched with SQLite metadata
  const retrieved: RetrievedChunk[] = [];

  for (const result of topK) {
    const doc = await getDocumentByDocId(result.doc_id);
    const sourceUrl = doc?.source_url || `/api/documents/${result.doc_id}`;
    retrieved.push({
      chunk_id: result.id,
      doc_id: result.doc_id,
      content: result.content,
      document_name: result.document_name,
      publisher: result.publisher,
      year: result.year,
      section_heading: result.section_heading,
      source_url: sourceUrl,
      similarity_score: result.score,
    });
  }

  return retrieved;
}
