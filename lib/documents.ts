import fs from "fs";
import path from "path";

export interface DocMetadata {
  doc_id: string;
  document_name: string;
  publisher: string;
  year: number;
  source_url?: string;
  doc_type?: string;
  filename: string;
}

let _cachedMetadata: DocMetadata[] | null = null;

export function getCorpusMetadata(): DocMetadata[] {
  if (_cachedMetadata) return _cachedMetadata;
  try {
    const metaPath = path.join(process.cwd(), "corpus", "metadata.json");
    if (fs.existsSync(metaPath)) {
      const data = fs.readFileSync(metaPath, "utf-8");
      _cachedMetadata = JSON.parse(data);
      return _cachedMetadata!;
    }
  } catch (err) {
    console.error("[documents] Failed to load corpus/metadata.json:", err);
  }
  return [];
}

export function findDocumentByIdOrName(query: string): {
  metadata?: DocMetadata;
  filePath?: string;
  mimeType?: string;
} {
  const metaList = getCorpusMetadata();
  const normalized = query.trim().toLowerCase();

  // 1. Direct match on doc_id
  let match = metaList.find((m) => m.doc_id.toLowerCase() === normalized);

  // 2. Match on filename
  if (!match) {
    match = metaList.find(
      (m) =>
        m.filename.toLowerCase() === normalized ||
        m.filename.toLowerCase() === `${normalized}.pdf` ||
        m.filename.toLowerCase() === `${normalized}.html`
    );
  }

  // 3. Match on document_name
  if (!match) {
    match = metaList.find(
      (m) =>
        m.document_name.toLowerCase() === normalized ||
        normalized.includes(m.document_name.toLowerCase()) ||
        m.document_name.toLowerCase().includes(normalized)
    );
  }

  // 4. Fuzzy fallback: match keywords in filename or doc_id
  if (!match) {
    match = metaList.find(
      (m) =>
        m.doc_id.toLowerCase().replace(/[-_]/g, " ").includes(normalized.replace(/[-_]/g, " ")) ||
        m.filename.toLowerCase().replace(/[-_]/g, " ").includes(normalized.replace(/[-_]/g, " "))
    );
  }

  if (match) {
    const fullPath = path.join(process.cwd(), "corpus", "raw", match.filename);
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(match.filename).toLowerCase();
      let mimeType = "application/octet-stream";
      if (ext === ".pdf") mimeType = "application/pdf";
      else if (ext === ".html" || ext === ".htm") mimeType = "text/html; charset=utf-8";
      else if (ext === ".txt") mimeType = "text/plain; charset=utf-8";

      return { metadata: match, filePath: fullPath, mimeType };
    }
  }

  return {};
}
