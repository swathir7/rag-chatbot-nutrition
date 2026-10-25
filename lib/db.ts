// lib/db.ts
// Phase 1 — SQLite database layer via better-sqlite3
// All operations are synchronous (better-sqlite3 API).

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.SQLITE_DB_PATH ?? "./nutrition-bot.db";

// Singleton connection — one per server process
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(path.resolve(/*turbopackIgnore: true*/ DB_PATH));
    _db.pragma("journal_mode = DELETE"); // WAL mode can cause segfaults on some network-attached persistent disks
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

// ── Schema init (idempotent) ────────────────────────────────

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id           TEXT PRIMARY KEY,
      session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role         TEXT CHECK(role IN ('user','assistant')) NOT NULL,
      content      TEXT NOT NULL,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session
      ON messages(session_id, created_at);

    CREATE TABLE IF NOT EXISTS failure_log (
      id            TEXT PRIMARY KEY,
      question      TEXT NOT NULL,
      category      TEXT NOT NULL,
      response_json TEXT,
      failure_types TEXT,
      run_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      doc_id          TEXT PRIMARY KEY,
      document_name   TEXT NOT NULL,
      publisher       TEXT NOT NULL,
      year            INTEGER NOT NULL,
      source_url      TEXT NOT NULL,
      retrieval_date  TEXT NOT NULL,
      doc_type        TEXT CHECK (doc_type IN ('nutrition', 'food_safety'))
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id              TEXT PRIMARY KEY,
      doc_id          TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
      document_name   TEXT NOT NULL,
      publisher       TEXT NOT NULL,
      year            INTEGER NOT NULL,
      section_heading TEXT NOT NULL,
      content         TEXT NOT NULL,
      chunk_index     INTEGER NOT NULL,
      token_count     INTEGER NOT NULL,
      embedding       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_doc_id
      ON chunks(doc_id);
  `);
}

// ── Session helpers ─────────────────────────────────────────

export function createSession(): string {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO sessions (id) VALUES (?)").run(id);
  return id;
}

export function sessionExists(id: string): boolean {
  const db = getDb();
  return db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(id) !== undefined;
}

// ── Message helpers ─────────────────────────────────────────

export interface RawMessage {
  role: string;
  content: string; // JSON string
}

export function getHistory(sessionId: string): RawMessage[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT role, content
       FROM messages
       WHERE session_id = ?
       ORDER BY created_at ASC
       LIMIT 20`
    )
    .all(sessionId) as RawMessage[];
}

export interface ParsedSessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  claims?: any[];
  created_at?: string;
}

export function getSessionMessages(sessionId: string): ParsedSessionMessage[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, role, content, created_at
       FROM messages
       WHERE session_id = ?
       ORDER BY created_at ASC`
    )
    .all(sessionId) as any[];

  return rows.map((r) => {
    try {
      const parsed = JSON.parse(r.content);
      if (r.role === "user") {
        return {
          id: r.id,
          role: "user",
          content: parsed.text ?? r.content,
          created_at: r.created_at,
        };
      } else {
        return {
          id: r.id,
          role: "assistant",
          content: parsed.answer ?? parsed.text ?? r.content,
          claims: parsed.claims ?? [],
          created_at: r.created_at,
        };
      }
    } catch {
      return {
        id: r.id,
        role: r.role,
        content: r.content,
        created_at: r.created_at,
      };
    }
  });
}

export function getAllSessions(limit: number = 150): Array<{ id: string; title: string; created_at: string; message_count: number }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.id, s.created_at, COUNT(m.id) as message_count,
              (SELECT content FROM messages WHERE session_id = s.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as first_user_msg
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       GROUP BY s.id
       HAVING COUNT(m.id) > 0
       ORDER BY s.created_at DESC
       LIMIT ?`
    )
    .all(limit) as any[];

  return rows.map((r) => {
    let title = "Chat Conversation";
    if (r.first_user_msg) {
      try {
        const p = JSON.parse(r.first_user_msg);
        title = p.text || title;
      } catch {
        title = r.first_user_msg;
      }
    }
    return {
      id: r.id,
      title: title.length > 50 ? title.substring(0, 50) + "..." : title,
      created_at: r.created_at,
      message_count: r.message_count,
    };
  });
}

export function saveMessages(
  sessionId: string,
  userText: string,
  assistantContent: object
): void {
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)"
  );

  db.transaction(() => {
    insert.run(
      crypto.randomUUID(),
      sessionId,
      "user",
      JSON.stringify({ text: userText })
    );
    insert.run(
      crypto.randomUUID(),
      sessionId,
      "assistant",
      JSON.stringify(assistantContent)
    );

    // Prune historical sessions beyond 150 to keep SQLite lean and performant
    try {
      db.prepare(`
        DELETE FROM sessions WHERE id NOT IN (
          SELECT id FROM sessions ORDER BY created_at DESC LIMIT 150
        )
      `).run();
    } catch {
      // Non-blocking cleanup
    }
  })();
}

// ── Failure Log Helpers ─────────────────────────────────────

export function logFailure(
  question: string,
  category: string,
  responseJson: string,
  failureTypes: string[]
): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO failure_log (id, question, category, response_json, failure_types) VALUES (?, ?, ?, ?, ?)"
  ).run(crypto.randomUUID(), question, category, responseJson, JSON.stringify(failureTypes));
}

export function getFailureLogs() {
  const db = getDb();
  return db.prepare("SELECT * FROM failure_log ORDER BY run_at DESC").all();
}

export function getAllQueries() {
  const db = getDb();
  const messages = db.prepare("SELECT * FROM messages ORDER BY created_at ASC").all();
  const queries = [];
  
  let lastUser: any = null;
  for (const m of messages as any[]) {
    try {
      const content = JSON.parse(m.content);
      if (m.role === 'user') {
        lastUser = { ...m, content };
      } else if (m.role === 'assistant' && lastUser && lastUser.session_id === m.session_id) {
        
        let assignedCategory = "All Categories";
        const lower = lastUser.content.text.toLowerCase();
        if (lower.includes("fasting") || lower.includes("16:8") || lower.includes("intermittent") || lower.includes("sweetener") || lower.includes("diet soda") || lower.includes("seed oil") || lower.includes("breakfast") || lower.includes("coffee") || lower.includes("egg") || lower.includes("cholesterol") || lower.includes("debate") || lower.includes("good or bad")) {
          assignedCategory = "Questions where nobody has a clear answer";
        } else if (lower.includes("steam") || lower.includes("boil") || lower.includes("fry") || lower.includes("smoke point") || lower.includes("microwave") || lower.includes("cook") || lower.includes("sous-vide") || lower.includes("reheat") || lower.includes("fridge") || lower.includes("freeze") || lower.includes("leftover") || lower.includes("wash") || lower.includes("clean") || lower.includes("bacteria") || lower.includes("salmonella")) {
          assignedCategory = "Food safety and storage";
        } else {
          assignedCategory = "Nutrient requirements";
        }

        queries.push({
          id: m.id,
          code: `LOG-${m.id.substring(0,4).toUpperCase()}`,
          sessionId: m.session_id,
          targetMsgId: lastUser.id,
          question: lastUser.content.text,
          answer: content.answer || "Declined",
          category: assignedCategory,
          claimsCount: content.claims ? content.claims.length : 0,
          timestamp: m.created_at,
          status: "Verified Response",
          tags: ["Global Database", assignedCategory.split(" ")[0]]
        });
        lastUser = null;
      }
    } catch(e) {}
  }
  return queries.reverse();
}

// ── Document Helpers ────────────────────────────────────────

export interface DocumentMeta {
  doc_id: string;
  document_name: string;
  publisher: string;
  year: number;
  source_url: string;
  retrieval_date: string;
  doc_type: string;
}

export function getDocumentByDocId(docId: string): DocumentMeta | undefined {
  const db = getDb();
  const doc = db.prepare("SELECT * FROM documents WHERE doc_id = ?").get(docId) as DocumentMeta | undefined;
  if (doc) {
    if (!doc.source_url || doc.source_url.startsWith("local") || doc.source_url.includes("example.com")) {
      doc.source_url = `/api/documents/${doc.doc_id}`;
    }
  }
  return doc;
}

export function getAllChunks() {
  const db = getDb();
  return db.prepare("SELECT * FROM chunks").all();
}

// Documents that actually have chunks in the index. The documents table also
// holds stale rows from earlier corpus versions, so it can't be used alone.
export function getIndexedDocuments(): Array<{ document_name: string; publisher: string; year: number }> {
  const db = getDb();
  return db
    .prepare(
      `SELECT document_name, publisher, year
       FROM chunks
       GROUP BY doc_id
       ORDER BY publisher, document_name`
    )
    .all() as Array<{ document_name: string; publisher: string; year: number }>;
}
