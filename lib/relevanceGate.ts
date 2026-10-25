// lib/relevanceGate.ts
// Phase 5 — Post-retrieval relevance gate
// Filters retrieved chunks below a similarity threshold.
// If no chunks pass, the query is considered a "corpus miss".

import type { RetrievedChunk } from "./retriever";
import { getIndexedDocuments } from "./db";

export interface GateResult {
  pass: boolean;
  relevant_chunks: RetrievedChunk[];
  searched_documents: string[];
}

// Same default as .env and render.yaml.
export const DEFAULT_RELEVANCE_THRESHOLD = 0.75;

// Built once from the indexed chunks, so the list always matches the corpus.
// Publishers with many short pages (FoodSafety.gov) are summarised as one entry.
let _searchedDocuments: string[] | null = null;

export function getSearchedDocuments(): string[] {
  if (_searchedDocuments) return _searchedDocuments;

  const byPublisher = new Map<string, Array<{ document_name: string; year: number }>>();
  for (const doc of getIndexedDocuments()) {
    if (!byPublisher.has(doc.publisher)) byPublisher.set(doc.publisher, []);
    byPublisher.get(doc.publisher)!.push(doc);
  }

  const single: string[] = [];
  const grouped: string[] = [];
  for (const [publisher, docs] of byPublisher) {
    // "World Health Organization (WHO)" → "WHO"
    const shortName = publisher.match(/\(([^)]+)\)\s*$/)?.[1] ?? publisher;
    if (docs.length > 2) {
      const years = Array.from(new Set(docs.map((d) => d.year))).sort().join("–");
      grouped.push(`${docs.length} ${shortName} pages (${years})`);
    } else {
      for (const d of docs) single.push(`${d.document_name} (${shortName}, ${d.year})`);
    }
  }

  _searchedDocuments = [...single, ...grouped];
  return _searchedDocuments;
}

export function relevanceGate(
  chunks: RetrievedChunk[],
  threshold?: number
): GateResult {
  const THRESHOLD =
    threshold ??
    parseFloat(process.env.RELEVANCE_THRESHOLD ?? String(DEFAULT_RELEVANCE_THRESHOLD));

  const relevant = chunks.filter((c) => c.similarity_score >= THRESHOLD);

  return {
    pass: relevant.length > 0,
    relevant_chunks: relevant,
    searched_documents: getSearchedDocuments(),
  };
}

export function buildCorpusMissResponse(searchedDocs: string[]): {
  answer: string;
  claims: [];
} {
  const docList = searchedDocs.join(", ");
  return {
    answer: `The dietary guidance documents I have access to (${docList}) don't appear to cover this topic. I can only answer questions addressed in these official guidance documents.`,
    claims: [],
  };
}
