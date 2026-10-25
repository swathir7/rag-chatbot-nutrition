# Milestone 2: Nutrition Bot Deployment Plan (Render Free Tier)

This document outlines the deployment strategy and step-by-step instructions for hosting the full-stack Milestone 2 Nutrition Bot on **Render Free Tier**.

---

## 1. Architecture & Free Tier Optimization

Milestone 2 includes an end-to-end RAG architecture consisting of:
- **Frontend**: Next.js 16 (App Router) + React 19 + TailwindCSS.
- **Backend**: API Routes (`/api/chat`, `/api/documents/[docId]`, `/api/history`, `/api/health`, `/api/logs`).
- **Vector Database**: Embedded Chroma DB (`chroma_db/chroma.sqlite3`).
- **Embeddings**: In-process local transformer model (`Xenova/jina-embeddings-v2-small-en`) via `@huggingface/transformers`.
- **Relational Storage**: SQLite (`nutrition-bot.db`) via `better-sqlite3`.
- **Knowledge Base**: 22 full-text source guideline documents in `corpus/raw/` (PDFs and HTML).

### How We Fit Inside Render Free Tier (512 MB RAM / 0.1 CPU):
1. **No External Microservices:** We eliminated the need for a separate Python FastAPI server and Chroma server. Everything runs within a single Node.js runtime process.
2. **Build-Time Model Pre-Caching:** In the `Dockerfile`, we pre-download the ~130 MB ONNX model during `docker build`. This prevents runtime downloads that cause container memory spikes or HTTP timeouts.
3. **C++ Native Dependencies:** The Dockerfile includes `python3`, `make`, and `g++` to compile `better-sqlite3` during `npm ci` via `node-gyp`.
4. **Synchronous Fast SQLite:** SQLite runs in DELETE journal mode (WAL mode can occasionally fail on certain virtual file systems).

---

## 2. Dockerfile Specification

```dockerfile
FROM node:22-bookworm-slim

# Install build tools and python for better-sqlite3 native compilation (node-gyp)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHON=/usr/bin/python3

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm ci

# Pre-cache the Jina ONNX embedding model inside image for instant cold starts
RUN node -e 'import("@huggingface/transformers").then(m => m.pipeline("feature-extraction", "Xenova/jina-embeddings-v2-small-en", { dtype: "fp32" })).catch(e => console.warn("Prefetch notice:", e.message))'

# Copy application files (including corpus/raw and database)
COPY . .

# Build Next.js app
RUN npm run build

# Make start script executable
RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/app/start.sh"]
```

---

## 3. Render Deployment Walkthrough

### Step 1: Connect Repository
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** &rarr; **Web Service**.
3. Select your GitHub repository: `Bhavya-Chadha-256/Milestone-2-Nutrition-Bot`.

### Step 2: Configure Service Settings
- **Name:** `nutrition-bot`
- **Region:** Any (e.g., Oregon, Frankfurt, Singapore)
- **Branch:** `main`
- **Root Directory:** `nutrition-bot`
- **Runtime:** `Docker`
- **Instance Type:** `Free`

### Step 3: Configure Environment Variables
In the **Environment Variables** section, configure:
| Variable | Value | Purpose |
|----------|-------|---------|
| `GROQ_API_KEY` | `gsk_...` | Authentication with Groq LLM API |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Model used for grounded responses |
| `RETRIEVAL_K` | `3` | Number of top document chunks retrieved |
| `RELEVANCE_THRESHOLD` | `0.70` | Minimum similarity score gate |
| `SQLITE_DB_PATH` | `./nutrition-bot.db` | Local SQLite database file |

### Step 4: Deploy & Verify
1. Click **Create Web Service**.
2. Monitor the build logs:
   - `apt-get` installs `python3`, `make`, `g++`.
   - `npm ci` compiles `better-sqlite3`.
   - `transformers` caches `Xenova/jina-embeddings-v2-small-en`.
   - `next build` produces static and dynamic routes.
3. Once the service shows **Live**, open your public URL (`https://nutrition-bot-xxxx.onrender.com`).

---

## 4. Production Smoke Tests

Once live, verify each core capability:
1. **General Chat & Grounding:**
   - Query: *"What are the 4 steps to food safety?"*
   - Verify answer includes *Clean, Separate, Cook, Chill*.
   - Verify verified statements are shown with source citations.
2. **Document Viewer:**
   - Click **"View source document"** on any source card.
   - Verify that `/api/documents/...` opens the actual PDF or HTML guideline directly in the browser.
3. **Medical Disclaimer:**
   - Confirm that advisory answers include the disclaimer: *"All dietary and medical advice should be checked with a qualified doctor or registered dietitian."*
4. **Scope Guard Interception:**
   - Query: *"Can you diagnose my stomach ache?"* or *"Give me a 1000 calorie diet plan."*
   - Verify that the bot safely declines without generating fake claims.
5. **Chat History:**
   - Ask a question, click **New Chat**, then click on the previous chat in the **Last 5 chats** sidebar to restore it.
