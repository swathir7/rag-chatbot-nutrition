# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

A nutrition and food-safety RAG chatbot built with Next.js 16 (App Router), React 19 and Tailwind 4. Answers must be grounded only in the 22 guideline documents in `corpus/raw/` (USDA, WHO, EFSA, UK Eatwell, FoodSafety.gov, NHMRC). The app lives in this `nutrition-bot/` directory. The parent folder only holds planning docs and an unrelated stray `package.json`/`node_modules`.

## Commands

```bash
npm run dev            # dev server on :3000
npm run build          # production build
npm run lint           # eslint (flat config, eslint-config-next)

# There is no test framework. Tests are standalone tsx scripts that print pass/fail:
npx tsx lib/scopeGuard.test.ts        # scope guard unit checks (no network)
npx tsx scripts/test-retrieval.ts     # retrieval only (loads the ONNX model)
npx tsx scripts/test-pipeline.ts      # end-to-end pipeline (needs GROQ_API_KEY)
npx tsx eval/run_retrieval_eval.ts    # retrieval hit-rate over eval/question-bank.json → eval/results/
npx tsx eval/run_m1_comparison.ts     # Milestone 1 question comparison
bash eval/run-eval.sh [base_url]      # HTTP smoke checks against a running server
```

Env (`.env`): `GROQ_API_KEY` (required), `GROQ_MODEL` (default `openai/gpt-oss-120b`), `RETRIEVAL_K` (default 3), `RELEVANCE_THRESHOLD` (0.75 in code, README, `.env` and `render.yaml`), `SQLITE_DB_PATH` (default `./nutrition-bot.db`).

## Architecture

### Request flow

`POST /api/chat` (`app/api/chat/route.ts`) → `ragPipeline()` (`lib/ragPipeline.ts`) → `saveMessages()`. The pipeline runs in this order and can return early at each stage:

1. **`checkPreRetrieval`** (`lib/scopeGuard.ts`): regex/keyword triage. It returns canned answers for medical or calorie-target requests, capabilities and meta questions, emergencies and seawater, threats, lost items, and animal or fictional queries, before any embedding or LLM call.
2. **`retrieveChunks`** (`lib/retriever.ts`): embeds the query in-process with `@huggingface/transformers` (`Xenova/jina-embeddings-v2-small-en`, mean pooling, normalized). It then loads **every** row of the SQLite `chunks` table, `JSON.parse`s each stored embedding and ranks them by brute-force cosine similarity.
3. **`relevanceGate`** (`lib/relevanceGate.ts`): if no chunk meets the threshold, it returns a canned "corpus miss" answer and skips the LLM.
4. **`buildPrompt`** (`lib/promptBuilder.ts`): **the live system prompt is defined here**, with the retrieved chunks injected. It includes the last 4 history messages.
5. **`callLLM`** (in `ragPipeline.ts`): Groq call with 429 backoff, JSON cleanup, and Zod validation against `ChatResponseSchema` (`lib/schema.ts`). On a schema mismatch it retries once with an error-correction suffix.
6. **Post-processing** (in `ragPipeline.ts`):
   - A list of refusal regexes clears `claims` when the answer is a decline.
   - Otherwise, each claim's source is re-mapped to the matching retrieved chunk (url, publisher, year).
   - A medical disclaimer is appended unless the answer already mentions a doctor or dietitian.

If you change refusal wording in the scope guard or prompt, keep the refusal regexes in `ragPipeline.ts` in sync, or claims will leak onto declines. The route's catch block also builds a framed denial instead of returning a 500.

### Dead and legacy code (don't edit these expecting an effect)

- `lib/groq.ts` and `lib/systemPrompt.ts`: an older client and prompt that nothing imports.
- `components/StitchApp.tsx`: unused. The UI entry is `app/page.tsx` → `components/ChatShell.tsx`.
- Chroma: `chromadb`, `chroma_db/` and `scripts/embed_server.py` (FastAPI embedder) remain from earlier phases. The runtime no longer uses Chroma, because brute-force SQLite avoids AVX segfaults on cheap cloud CPUs.

### Data and storage

One SQLite file (`better-sqlite3`, sync API, singleton in `lib/db.ts`) holds both app state and the index:

- **App state:** `sessions`, `messages` and `failure_log`. Message `content` is stored as JSON (`{text}` for the user, the full response for the assistant), and readers parse it back.
- **Index:** `documents` and `chunks` (embedding stored as a JSON text array).

The schema is created idempotently on first connection. `journal_mode = DELETE` is deliberate: WAL caused segfaults on network disks.

### Ingestion pipeline (Python, offline)

`corpus/raw/` → `scripts/parse_documents.py` → `corpus/parsed/` → `scripts/build_index.py` (tiktoken chunking, 800 tokens with 100 overlap; writes to Chroma) → `migrate.py` (copies Chroma chunks into the SQLite `chunks` table). `scripts/seed_documents.py` fills `documents` from `corpus/metadata.json`. Python deps are in `requirements.txt`.

Query-time embeddings must come from the same Jina model used at index time.

### Source documents

`/api/documents/[docId]` (and `?id=` / `?name=` forms) streams the original file from `corpus/raw/`, using `corpus/metadata.json` (via `lib/documents.ts`) to map `doc_id` to `filename`. Claim URLs point at this route.

### Deployment

Docker on Render's free tier (512 MB). See `Dockerfile`, `render.yaml` and `start.sh`.

- The image pre-downloads the ONNX model at build time.
- It ships the pre-indexed `nutrition-bot.db`. `start.sh` copies that file to `SQLITE_DB_PATH` if the target is missing on a fresh persistent disk.
- `.gitignore` excludes `*.db*`, so a git-based deploy won't include the index unless it is committed or built.
- `next.config.ts` marks `better-sqlite3`, `onnxruntime-node` and `sharp` as `serverExternalPackages`. Keep this when adding native deps.
