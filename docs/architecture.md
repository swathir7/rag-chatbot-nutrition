# Architecture — Milestone 2 Dietary Guidance RAG Chatbot

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER (Browser)                                │
│                                                                            │
│   ┌──────────────────────┐          ┌─────────────────────────────────┐     │
│   │    Chat Panel         │          │     Sources Panel (M2 new)     │     │
│   │  ┌────────────────┐  │          │  ┌───────────────────────────┐  │     │
│   │  │  Message List   │  │          │  │  Chunk citations per     │  │     │
│   │  │  (user + bot)   │  │  ◄───►  │  │  claim: doc name,        │  │     │
│   │  ├────────────────┤  │          │  │  publisher, year, link    │  │     │
│   │  │  Input Box      │  │          │  └───────────────────────────┘  │     │
│   │  └────────────────┘  │          └─────────────────────────────────┘     │
│   └──────────────────────┘                                                  │
└────────────────────┬────────────────────────────────────────────────────────┘
                     │  POST /api/chat { message, session_id }
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Next.js API)                            │
│                                                                            │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐  │
│   │  Scope   │──►│ Retrieve │──►│ Relevance│──►│ Generate │──►│  Zod   │  │
│   │  Guard   │   │  Chunks  │   │  Gate    │   │  Answer  │   │ Parse  │  │
│   │ (code)   │   │ (vector) │   │ (score)  │   │ (LLM)   │   │        │  │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └────────┘  │
│        │                                                           │       │
│        │ blocked                                              validated    │
│        ▼                                                           ▼       │
│   { decline msg }                                        { answer, claims  │
│                                                            with sources }  │
└─────────┬──────────────────────────────────────────────────────┬───────────┘
          │                                                      │
          ▼                                                      ▼
┌──────────────────┐                                  ┌──────────────────────┐
│  Vector Store    │                                  │   Relational DB      │
│  (Chroma DB)     │                                  │   (SQLite)           │
│                  │                                  │                      │
│  - embeddings    │                                  │  - sessions          │
│  - chunks text   │                                  │  - messages          │
│  - metadata      │                                  │                      │
└──────────────────┘                                  └──────────────────────┘
```

---

## 2. Directory Structure

```
nutrition-bot/
├── docs/                              # Project documentation
│   ├── problemStatement.md
│   ├── architecture.md                 # ← this file
│   └── implementation-plan.md
│
├── corpus/                             # Raw source documents
│   ├── raw/                            # Original PDFs / HTMLs
│   │   ├── usda-dietary-guidelines.pdf
│   │   ├── who-healthy-diet.html
│   │   ├── uk-eatwell-guide.pdf
│   │   ├── efsa-drv-summary.pdf
│   │   ├── foodsafety-cold-storage.html
│   │   ├── au-dietary-guidelines.pdf
│   │   └── fda-food-code.pdf
│   ├── parsed/                         # Extracted plain text per doc
│   └── metadata.json                   # Publisher, year, URL, retrieval date per doc
│
├── scripts/                            # Offline pipeline scripts
│   ├── parse_documents.py              # PDF/HTML → plain text
│   ├── chunk_documents.py              # Text → metadata-rich chunks
│   ├── embed_and_index.py              # Chunks → embeddings → vector store
│   └── verify_index.py                 # Sanity-check: k queries, print top chunks
│
├── src/                                # Next.js app (carried from M1)
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts            # POST handler — the RAG pipeline lives here
│   │   ├── page.tsx                    # Chat UI
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── ChatPanel.tsx               # Message list + input (M1, unchanged)
│   │   ├── MessageBubble.tsx           # Single message (M1, unchanged)
│   │   ├── SourcesPanel.tsx            # Side panel — NOW POPULATED (M2)
│   │   ├── SourceCard.tsx              # Single citation card (M2 new)
│   │   └── LoadingIndicator.tsx        # Typing indicator (M1, unchanged)
│   │
│   ├── lib/
│   │   ├── db.ts                       # SQLite client + DB helpers (M1 & M2)
│   │   ├── scopeGuard.ts              # Regex-based blocking (M1, unchanged)
│   │   ├── retriever.ts               # NEW — vector search + metadata filter
│   │   ├── relevanceGate.ts           # NEW — score threshold + corpus-miss detection
│   │   ├── ragPipeline.ts             # NEW — orchestrates retrieve → gate → generate
│   │   ├── promptBuilder.ts           # NEW — builds system prompt with retrieved context
│   │   └── schema.ts                  # Zod schema (UPDATED — source: null → citation obj)
│   │
│   └── types/
│       └── index.ts                    # TypeScript interfaces
│
├── eval/
│   ├── question-bank.json              # 15+ questions with expected doc + section
│   ├── milestone1-questions.json       # The 10 M1 questions for before/after
│   ├── run-eval.sh                     # Automated eval runner
│   └── results/                        # Eval outputs
│
├── .env.local                          # API keys, DB URL, embedding config
├── package.json
├── tsconfig.json
└── README.md                           # Chunk size, overlap, model, index type, k
```

---

## 3. Data Models

### 3.1 Document Metadata

Stored in `corpus/metadata.json` and mirrored in the `documents` DB table.

```typescript
interface DocumentMeta {
  doc_id: string;              // e.g., "usda-dga-2020"
  document_name: string;       // "Dietary Guidelines for Americans, 2020–2025"
  publisher: string;           // "USDA & HHS"
  year: number;                // 2020
  source_url: string;          // the public URL
  retrieval_date: string;      // ISO date when you downloaded it
  doc_type: "nutrition" | "food_safety";
}
```

### 3.2 Chunk

Each chunk carries full provenance. This is the unit that gets embedded and retrieved.

```typescript
interface Chunk {
  chunk_id: string;            // UUID
  doc_id: string;              // FK → DocumentMeta
  document_name: string;       // denormalised for prompt injection
  publisher: string;           // denormalised
  year: number;                // denormalised
  section_heading: string;     // e.g., "Chapter 1 — Nutritional Goals"
  content: string;             // the actual text
  chunk_index: number;         // position within the document
  token_count: number;         // for context-window budgeting
}
```

### 3.3 Vector Store (Chroma DB)

Chroma DB handles storage, metadata, and indexing internally via a local `nutrition_chunks` collection. We don't manually construct SQL tables for chunks.

### 3.4 Response Schema (M2 — Updated)

```typescript
// M1 schema with source: null
// M2 schema with source: Citation object

interface Citation {
  document_name: string;       // "Dietary Guidelines for Americans, 2020–2025"
  publisher: string;           // "USDA & HHS"
  year: number;                // 2020
  url: string;                 // public source URL
  section: string;             // section heading the chunk came from
}

interface Claim {
  claim_text: string;          // factual statement extracted by the model
  source: Citation;            // M2: always populated, never null
}

interface ChatResponse {
  answer: string;              // natural-language response
  claims: Claim[];             // every claim has a citation
}
```

**Zod enforcement:**

```typescript
import { z } from "zod";

const CitationSchema = z.object({
  document_name: z.string().min(1),
  publisher: z.string().min(1),
  year: z.number().int().min(1900).max(2030),
  url: z.string().url(),
  section: z.string().min(1),
});

const ClaimSchema = z.object({
  claim_text: z.string().min(1),
  source: CitationSchema,       // M2: no longer nullable
});

const ChatResponseSchema = z.object({
  answer: z.string().min(1),
  claims: z.array(ClaimSchema).min(1),
});
```

### 3.5 Database Tables (SQLite Postgres)

```sql
-- Carried from M1
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES sessions(id),
  role        TEXT CHECK (role IN ('user', 'assistant')),
  content     JSONB NOT NULL,        -- stores full ChatResponse for assistant msgs
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- New in M2
CREATE TABLE documents (
  doc_id          TEXT PRIMARY KEY,
  document_name   TEXT NOT NULL,
  publisher       TEXT NOT NULL,
  year            INT  NOT NULL,
  source_url      TEXT NOT NULL,
  retrieval_date  DATE NOT NULL,
  doc_type        TEXT CHECK (doc_type IN ('nutrition', 'food_safety'))
);
```

---

## 4. Pipeline Stages (Offline — Runs Once)

### 4.1 Stage 1: Parse

```
Raw PDF/HTML  ──►  parse_documents.py  ──►  parsed/<doc_id>.txt
```

| Document type | Parser | Rationale |
|---------------|--------|-----------|
| PDF (tables + prose) | **PyMuPDF** (`fitz`) | Preserves table structure, fast, no external service |
| HTML (WHO, FoodSafety.gov) | **BeautifulSoup** | Simple DOM → text extraction |

**Output:** One `.txt` file per document in `corpus/parsed/`, with section headings preserved as `## Heading` markers.

### 4.2 Stage 2: Chunk

```
parsed/<doc_id>.txt  ──►  chunk_documents.py  ──►  chunks[] with metadata
```

**Strategy: Multi-Level Markdown Heading Splitting**

1. **Primary split** on any markdown heading level (e.g., `#`, `##`, `###`) to preserve exact, granular context for documents with deep hierarchy.
2. **Secondary split** on paragraphs if a section exceeds `max_chunk_size` (required for very long academic PDF sections).
3. **Never split** inside a table or numbered list — keep these atomic

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `max_chunk_size` | 800 tokens | Fits 6–8 chunks in context window alongside system prompt + conversation history |
| `chunk_overlap` | 100 tokens | Preserves cross-boundary context for recommendations that span paragraphs |
| `min_chunk_size` | 50 tokens | Avoids degenerate tiny chunks from short sections |

**Metadata injection:** Every chunk gets `document_name`, `publisher`, `year`, `section_heading` attached before storage.

### 4.3 Stage 3: Embed & Index

```
chunks[]  ──►  build_index.py  ──►  Local Chroma DB
```

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Embedding model** | `jinaai/jina-embeddings-v2-small-en` | 8192 context limit allows 800-token chunks to fit perfectly, 100% local |
| **Vector Database** | Chroma DB | Built-in indexing, easy local setup without SQL |
| **Distance metric** | Cosine similarity | Standard for text embeddings |

---

## 5. Pipeline Stages (Online — Every Request)

### 5.1 Request Flow

```
User message
     │
     ▼
┌─────────────────┐
│  1. Scope Guard  │──── blocked ────► { decline_message, claims: [] }
│  (scopeGuard.ts) │
└────────┬────────┘
         │ passed
         ▼
┌─────────────────┐
│  2. Retrieve     │
│  (retriever.ts)  │──── top-k chunks from vector store
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  3. Relevance Gate   │──── all below threshold ────► { corpus_miss_message }
│  (relevanceGate.ts)  │
└────────┬────────────┘
         │ at least 1 relevant
         ▼
┌──────────────────┐
│  4. Build Prompt  │
│  (promptBuilder)  │──── system prompt + retrieved chunks + conversation history
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  5. LLM Call      │
│  (Groq API)       │──── structured output mode
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  6. Zod Parse     │──── invalid ────► retry once or return error
│  (schema.ts)      │
└────────┬─────────┘
         │ valid
         ▼
┌──────────────────┐
│  7. Persist       │──── save to messages table
│  (db.ts)          │
└────────┬─────────┘
         │
         ▼
    Return ChatResponse to frontend
```

### 5.2 Stage Detail: Scope Guard

**Unchanged from M1.** Runs *before* retrieval to avoid wasting a vector search on queries that will be declined anyway.

```typescript
// scopeGuard.ts — same regex patterns from M1
const BLOCKED_PATTERNS = [
  /calorie\s*(target|goal|need|require|intake|count|budget)/i,
  /how\s*many\s*calories/i,
  /weight\s*(target|goal|lose|gain|loss)/i,
  /bmi|body\s*mass/i,
  /should\s*i\s*weigh/i,
  /what\s*should\s*(i|he|she|they|my)\s*weigh/i,
  /prescri(be|ption)/i,
  /diagnos(e|is|tic)/i,
  /treat(ment|ing)?\s*(for|of)/i,
  /medical\s*advice/i,
  /supplement\s*dos(age|e|ing)/i,
  // ... additional patterns
];

export function isBlocked(message: string): boolean {
  return BLOCKED_PATTERNS.some(p => p.test(message));
}
```

### 5.3 Stage Detail: Retriever

```typescript
// retriever.ts

interface RetrievalOptions {
  query: string;
  k: number;                        // default: 6
  filter?: { doc_id: string };      // optional per-document filter
  similarityThreshold?: number;     // default: 0.3
}

interface RetrievedChunk {
  chunk_id: string;
  content: string;
  document_name: string;
  publisher: string;
  year: number;
  section_heading: string;
  source_url: string;
  similarity_score: number;
}

async function retrieveChunks(options: RetrievalOptions): Promise<RetrievedChunk[]> {
  // Query Chroma DB
  // Note: you will need to encode the query text using the Jina model API first, 
  // or use an embedding function built for JS before querying Chroma.
  const data = await searchChromaVectorStore({
    queryText: options.query,
    match_count: options.k
  });
  
  // 3. Filter below threshold
  return data.filter(c => c.similarity_score >= options.similarityThreshold);
}
```

**Retrieval parameters (to be stated in README):**

| Parameter | Value |
|-----------|-------|
| `k` | 6 |
| `similarity_threshold` | 0.45 |
| Embedding model | `jinaai/jina-embeddings-v2-small-en` |
| Vector Store | Chroma DB |
| Distance metric | Cosine |

### 5.4 Stage Detail: Relevance Gate

Separates "corpus doesn't cover this" from "scope guard blocked it."

```typescript
// relevanceGate.ts

interface GateResult {
  pass: boolean;
  relevant_chunks: RetrievedChunk[];
  searched_documents: string[];       // names of docs that were searched
}

function relevanceGate(
  chunks: RetrievedChunk[],
  allDocNames: string[]
): GateResult {
  const relevant = chunks.filter(c => c.similarity_score >= RELEVANCE_THRESHOLD);
  
  return {
    pass: relevant.length > 0,
    relevant_chunks: relevant,
    searched_documents: allDocNames,
  };
}

// When gate fails → return a corpus-miss refusal:
// "The dietary guidance documents I have access to
//  ({doc1}, {doc2}, ...) don't appear to cover this topic."
```

**Threshold:** `RELEVANCE_THRESHOLD = 0.45`

- Below 0.45 = the best chunk is only loosely related → refuse
- This is tuned empirically during eval; start here, adjust based on hit-rate

### 5.5 Stage Detail: Prompt Builder

Constructs the full prompt sent to the LLM with retrieved context injected.

```typescript
// promptBuilder.ts

function buildPrompt(
  retrievedChunks: RetrievedChunk[],
  conversationHistory: Message[],
  userMessage: string
): { systemPrompt: string; messages: Message[] } {

  // Group chunks by document for cross-document clarity
  const grouped = groupBy(retrievedChunks, "document_name");

  const contextBlock = Object.entries(grouped)
    .map(([docName, chunks]) => {
      const meta = chunks[0];
      const header = `--- ${docName} (${meta.publisher}, ${meta.year}) ---`;
      const body = chunks.map(c =>
        `[Section: ${c.section_heading}]\n${c.content}`
      ).join("\n\n");
      return `${header}\n${body}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a dietary guidance assistant. You answer questions about food, nutrition, and food safety using ONLY the reference documents provided below.

RULES:
1. Answer ONLY from the provided context. Do not use your own knowledge.
2. Every factual claim must cite its source document by name, publisher, and year.
3. When multiple documents address the same topic, present each document's position separately with its own citation. Never blend sources.
4. If the context does not contain enough information to answer, say so explicitly.
5. Population-level guidance stays population-level. Do not turn it into personal recommendations.
6. Never provide calorie targets, weight targets, or medical advice.
7. Return your response as structured JSON matching the required schema.

REFERENCE DOCUMENTS:
${contextBlock}`;

  return {
    systemPrompt,
    messages: [
      ...conversationHistory,
      { role: "user", content: userMessage },
    ],
  };
}
```

### 5.6 Stage Detail: LLM Call

```typescript
// Using Groq (carried from M1)

const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",   // or latest available
  messages: [
    { role: "system", content: systemPrompt },
    ...messages,
  ],
  response_format: { type: "json_object" },
  temperature: 0.2,                    // low for factual consistency
  max_tokens: 2048,
});
```

**Why Groq?** Already used in M1. Free tier, fast inference, supports JSON mode.

### 5.7 Stage Detail: Zod Parse & Persist

```typescript
const raw = JSON.parse(completion.choices[0].message.content);
const parsed = ChatResponseSchema.safeParse(raw);

if (!parsed.success) {
  // Retry once with stricter prompt, or return error
  throw new SchemaValidationError(parsed.error);
}

// Persist to DB
await db.insertMessage({
  session_id,
  role: "assistant",
  content: parsed.data,  // full structured response stored as JSONB
});

return parsed.data;
```

---

## 6. Cross-Document Handling

When multiple documents address the same topic, the architecture ensures they are **never blended**:

```
Query: "What temperature should I cook chicken to?"
         │
         ▼
    Retrieve top-6 chunks
         │
    ┌────┴────┐
    │         │
   FDA     USDA
  Food    Dietary
  Code    Guidelines
    │         │
    ▼         ▼
  Claim 1   Claim 2
  (FDA,     (USDA,
   2022)     2020)
```

**Implementation:**

1. Chunks from different documents get **separate citations**
2. The system prompt instructs: *"present each document's position separately"*
3. The Zod schema enforces that each claim has exactly **one** source citation
4. If documents disagree → both positions shown with publisher + year, no winner picked

---

## 7. Two Refusal Paths

```
User message
     │
     ▼
  Scope Guard ─── blocked ──► "I can't provide [calorie targets / medical advice /
     │                          weight recommendations]. Please consult a
     │                          qualified professional."
     │ passed
     ▼
  Retriever + Gate ─── miss ──► "The dietary guidance documents I have access to
                                 (USDA DGA, WHO, Eatwell Guide, EFSA, FoodSafety.gov,
                                  Australian DG, FDA Food Code) don't appear to
                                  cover this topic."
```

| Refusal | Trigger | Response includes |
|---------|---------|-------------------|
| **Scope guard** | Regex match on banned topics | Decline + professional referral |
| **Corpus miss** | All retrieved chunks below relevance threshold | Decline + list of searched documents |

**Key distinction:** Scope guard fires *before* retrieval (saves a vector search). Corpus miss fires *after* retrieval but *before* generation (saves an LLM call).

---

## 8. Frontend Integration (M2 Changes)

### 8.1 SourcesPanel (Now Populated)

```
┌─────────────────────────────────┐
│  📚 Sources                     │
│                                 │
│  ┌───────────────────────────┐  │
│  │ USDA Dietary Guidelines   │  │
│  │ USDA & HHS, 2020          │  │
│  │ Section: Nutritional Goals │  │
│  │ 🔗 View source            │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ FDA Food Code             │  │
│  │ FDA, 2022                 │  │
│  │ Section: Time/Temperature │  │
│  │ 🔗 View source            │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

### 8.2 Component Changes

| Component | M1 → M2 Change |
|-----------|-----------------|
| `SourcesPanel.tsx` | Was empty shell → now renders `SourceCard` list from `claims[].source` |
| `SourceCard.tsx` | **New** — displays document name, publisher, year, section, link |
| `MessageBubble.tsx` | Minor: claim text can now be hovered/clicked to highlight its source card |
| `ChatPanel.tsx` | **Unchanged** — still sends `{ message, session_id }` to `/api/chat` |

### 8.3 API Contract

**Request** — unchanged from M1:

```
POST /api/chat
Content-Type: application/json

{
  "message": "How long can I keep cooked chicken in the fridge?",
  "session_id": "uuid-here"
}
```

**Response** — M2 updated:

```json
{
  "answer": "According to the FDA and FoodSafety.gov guidelines, cooked chicken can be safely stored in the refrigerator for 3 to 4 days.",
  "claims": [
    {
      "claim_text": "Cooked chicken can be stored in the refrigerator for 3 to 4 days.",
      "source": {
        "document_name": "Cold Food Storage Charts",
        "publisher": "FoodSafety.gov (USDA / FDA / CDC)",
        "year": 2024,
        "url": "https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts",
        "section": "Cooked Meat & Poultry"
      }
    },
    {
      "claim_text": "After 3 to 4 days, the food should be discarded or frozen for longer storage.",
      "source": {
        "document_name": "FDA Food Code",
        "publisher": "U.S. Food & Drug Administration (FDA)",
        "year": 2022,
        "url": "https://www.fda.gov/food/retail-food-protection/fda-food-code",
        "section": "Chapter 3 — Time/Temperature Control"
      }
    }
  ]
}
```

---

## 9. Configuration & Environment

### 9.1 Environment Variables (`.env.local`)

```bash
# Model (carried from M1)
GROQ_API_KEY=gsk_...

# RAG Configuration
EMBEDDING_MODEL=jinaai/jina-embeddings-v2-small-en
CHUNK_SIZE=800
CHUNK_OVERLAP=100
RETRIEVAL_K=6
RELEVANCE_THRESHOLD=0.45
```

### 9.2 README Configuration Table (Required by Problem Statement)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Chunk size | 800 tokens | Section-aware splitting |
| Chunk overlap | 100 tokens | Cross-boundary context |
| Embedding model | `jinaai/jina-embeddings-v2-small-en` | 8192 context limit |
| Vector Store | Chroma DB | |
| k value | 6 | Top-k retrieved chunks |
| Relevance threshold | 0.45 | Below = corpus miss |

---

## 10. Key Architectural Decisions

| Decision | Choice | Alternative considered | Why |
|----------|--------|----------------------|-----|
| **Vector store** | Chroma DB | SQLite | Zero external infra, fastest to build and fully local, no SQL vectors needed |
| **Embedding** | `jina-embeddings-v2-small-en` | BGE Large / OpenAI | Fits 800-token chunks with 8192 limit, perfectly local and free |
| **Chunking** | Multi-level markdown heading split + recursive fallback | Fixed-size 512-token | Documents have tables/lists that fixed-size breaks; multi-level splitting preserves granular semantic context. |
| **Orchestration** | Plain TypeScript | LangChain | 5-step pipeline is simple enough; avoids abstraction overhead |
| **LLM** | Groq (Llama 3.3 70B) | OpenAI GPT-4o | Carried from M1; free tier; JSON mode supported |
| **Refusal architecture** | Two-stage (scope → corpus) | Single-stage | Saves vector search on banned topics; clearer UX messaging |
| **Metadata in chunks** | Denormalised | Normalised (join at query time) | Prompt assembly is simpler; no extra DB round-trip |

---

## 11. Constraints & Boundaries

### In Scope (M2)

- RAG pipeline over dietary guidance prose documents
- Citation on every claim
- Two kinds of refusal (scope guard + corpus miss)
- Sources panel populated in frontend
- 15+ question evaluation with hit-rate reporting

### Out of Scope (M3+)

- **Nutrient databases** (structured food composition data) — Milestone 3
- **User accounts / auth** — not required
- **Streaming responses** — nice-to-have, not required
- **Re-ranking** (e.g., Cohere rerank) — consider if retrieval quality is insufficient
- **Hybrid search** (keyword + vector) — consider if pure vector misses exact numbers

---

## 12. Production Enhancements & Deployment Architecture

### 12.1 In-App Source Document Serving
- **Endpoint**: `/api/documents/[docId]` and `/api/documents?id=...`
- **Purpose**: Instead of redirecting to third-party URLs that may suffer from link rot, all 22 authoritative guideline documents (PDFs & HTML) are bundled in `corpus/raw/` and streamed directly to the browser with `Content-Disposition: inline`.
- **User Experience**: Clicking "View source document" in the UI opens the exact original document inside the browser's native PDF/HTML viewer.

### 12.2 Conversation History & Session Persistence
- **Endpoints**: `/api/history` (list sessions), `/api/history?session_id=...` (load transcript).
- **Client Components**:
  - `Last 5 Chats Sidebar`: Real-time list of most recent chat sessions with timestamps.
  - `History Drawer`: Slide-over modal to browse and switch between all historical sessions.
  - Sessions and user/assistant messages persist seamlessly across requests in SQLite (`nutrition-bot.db`).

### 12.3 Predefined Category Exploration Prompts
- Embedded prompt pills located directly above the chat input representing core competencies:
  1. **Nutrient requirements** (e.g., daily intake, vitamins, dietary reference values)
  2. **Food safety and storage** (e.g., refrigeration limits, cross-contamination)
  3. **Cooking methods** (e.g., safe internal temperatures, resting times)
- Features a dismiss button (`✕`) with automatic reappearance upon starting a new chat.

### 12.4 Grounded Factuality & Disclaimer Enforcement
- **Negative/Refusal Suppression**: Whenever the model issues a scope decline or corpus miss ("The documents do not contain..."), `claims` is strictly forced to `[]` to prevent phantom verified statements.
- **Mandatory Medical Disclaimer**: All advisory and factual guidance responses automatically append:
  > *"Disclaimer: All dietary and medical advice should be checked with a qualified doctor or registered dietitian."*

### 12.5 Single-Container Render Free Tier Deployment
- **Model In-Process Execution**: Utilizes `@huggingface/transformers` in Node.js with the ONNX runtime to execute `jina-embeddings-v2-small-en` without requiring a standalone Python microservice.
- **Docker Pre-Caching**: The ~130 MB ONNX model is downloaded during the image build step, eliminating cold-start latency and network timeouts on Render.
- **Native Node-Gyp Support**: Multi-stage Debian-based Docker image installs `python3`, `make`, and `g++` to compile `better-sqlite3` natively.
