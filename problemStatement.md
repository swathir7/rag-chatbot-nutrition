# Milestone 2 — Dietary Guidance RAG Chatbot

## Brief

Put a retrieval layer under the chatbot built in Milestone 1, so it answers **only from official public dietary guidance documents**. Every claim carries a citation. When the guidance doesn't cover a question, the assistant says so.

---

## Where This Goes

### What Milestone 1 Delivered

Milestone 1 gave you a frontend, a backend, and a response schema with an **empty `source` field** on every claim. The model answered from its own memory — no documents, no citations, no grounding.

The failure log from that phase documented the symptoms:

- Numbers that **move between runs**
- Authorities **cited that never said it**
- Claims with **nothing behind them**

### What Milestone 2 Changes

This week you **fill that `source` field in**. The interface doesn't change, but an answer now has to come from a document you can point at.

In the final project this becomes the service that answers:

- *"Is this a reasonable way to eat?"*
- *"How long can I keep this in the fridge?"*

---

## The Problem

The real guidance exists. Health authorities publish long, careful, boring PDFs on exactly this topic. No API, just written prose — and almost nobody reads them.

That gap is what **RAG (Retrieval-Augmented Generation)** is for: bridging the distance between published authoritative guidance and the user's natural-language question.

> **Important boundary:** Nutrient numbers for individual foods are different data and don't belong here. Those come from a structured database in **Milestone 3**.

---

## The Pipeline — What You Build

### 1. Corpus

We have gathered **22 public guidance documents** from recognised authorities, including extensive FoodSafety.gov PDFs, EFSA, WHO, and Australian Dietary Guidelines.

**Requirements:**

- Written prose only — anything with a clean API behind it doesn't belong here
- A script (`scripts/generate_metadata.py`) dynamically generates the metadata for all 22 documents, storing:
  - Publisher
  - Year
  - Source URL (or local identifier)
  - Retrieval date

- The parsing pipeline uses `pymupdf4llm` to extract high-fidelity Markdown, preserving tables perfectly while intentionally stripping out noise like "References", "Table of Contents", and "Glossary".

#### Recommended Corpus (7 Documents)

| # | Document | Publisher | Year | Type | URL |
|---|----------|-----------|------|------|-----|
| 1 | **Dietary Guidelines for Americans, 2020–2025** | USDA & HHS | 2020 | Nutrition guidance | [odphp.health.gov](https://odphp.health.gov/our-work/nutrition-physical-activity/dietary-guidelines) |
| 2 | **Healthy Diet Fact Sheet** | World Health Organization (WHO) | 2024 | Nutrition guidance | [who.int](https://www.who.int/news-room/fact-sheets/detail/healthy-diet) |
| 3 | **The Eatwell Guide** | Public Health England (UK Gov) | 2016 | Nutrition guidance | [gov.uk](https://www.gov.uk/government/publications/the-eatwell-guide) |
| 4 | **Dietary Reference Values — Summary Report** | European Food Safety Authority (EFSA) | 2017 | Nutrient reference values | [efsa.europa.eu](https://www.efsa.europa.eu/en/supporting/pub/e15121) |
| 5 | **Cold Food Storage Charts** | FoodSafety.gov (USDA / FDA / CDC) | 2024 | Food safety | [foodsafety.gov](https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts) |
| 6 | **Australian Dietary Guidelines** | NHMRC | 2013 | Nutrition guidance | [eatforhealth.gov.au](https://www.eatforhealth.gov.au/guidelines) |
| 7 | **FDA Food Code** | U.S. Food & Drug Administration (FDA) | 2022 | Food safety | [fda.gov](https://www.fda.gov/food/retail-food-protection/fda-food-code) |

> **Why these 7?** They cover three continents (US, UK/EU, Australia) plus WHO for international scope. Five are nutrition/nutrient guidance documents and two (FDA Food Code + FoodSafety.gov storage charts) are food safety — ensuring coverage for cross-document questions like cooking temperatures and food storage where both nutrition and safety authorities weigh in.

### 2. Chunking

Every chunk must carry:

- **Document name**
- **Publisher**
- **Year**
- **Section heading**

> These documents are full of tables and numbered recommendations that fixed-size chunking will cut in half. Say in the README what strategy you chose and what it cost you.

### 3. Retrieval

Build a **vector index** over the chunks, supporting:

- Retrieval **across all documents**
- Retrieval **filtered to one named document**

### 4. Answer Layer

The assistant answers **only from retrieved chunks**. Every claim carries a citation showing:

- Document name
- Publisher
- Year
- A link to the source

### 5. Cross-Document Questions

Some questions have two documents with something to say — like cooking oil, where a nutrition institute and a food safety regulator both weigh in.

**Requirements:**

- Answer **per document**, with separate citations
- **Never** blend two sources into one claim about what "the guidelines say"

### 6. Two Kinds of Refusal

You need **both**:

| Refusal Type | Behaviour |
|---|---|
| **Not in the corpus** | When the retrieved chunks don't hold the answer, the assistant says the guidance doesn't cover it and names what it searched |
| **Out of scope by design** | No medical advice, no calorie or weight targets, nothing about what anyone should weigh. It declines and points the person to a qualified professional. **Enforce this in code**, same as Milestone 1 |

### 7. Filling in the Shell

**Don't rebuild the frontend or backend.** Instead:

- The **sources panel** you left empty now shows the chunks behind each answer
- The **`source` field** on every claim carries a real citation instead of `null`
- If your schema doesn't fit real citations, **change it and note what you changed**

---

## Tools

| Area | Options |
|------|---------|
| **PDF Parsing** | PyMuPDF, Unstructured, Docling, or LlamaParse |
| **Chunking** | LangChain text splitters, or your own splitter that breaks on section headings |
| **Embeddings** | OpenAI `text-embedding-3-small`, Cohere Embed, or `sentence-transformers` (local & free) |
| **Vector Store** | Local SQLite, Pinecone, or Qdrant (self-hosted) |
| **Orchestration** | LangChain or plain Python if you want to see every step |
| **Everything Else** | Same stack as Milestone 1 |

---

## Rules

- [ ] Answers come from **retrieved text only**. Model knowledge is not a source.
- [ ] Every claim carries a **citation**. No citation means the claim doesn't ship.
- [ ] Population-level guidance stays population-level. The assistant **doesn't turn it into a personal recommendation**.
- [ ] **No calorie targets, no weight targets, no medical advice**, anywhere in the conversation.
- [ ] When two documents **disagree**, show both with their publishers and years. Don't pick a winner.
- [ ] **5 to 7 documents** in the corpus.
- [ ] State **chunk size, overlap, embedding model, index type, and k value** in the README.
- [ ] Model calls run **behind your backend** (carried over from Milestone 1).

---

## Before You Submit

### ✅ Build a Question Bank

Write at least **15 questions** where you already know which document and section holds the answer.

- Check whether the right chunk came back in the **top-k**
- Report the **hit rate**

> A wrong answer can come from bad retrieval or bad generation, and the fix is different for each.

### ✅ Try to Break It

1. Ask something **none of your documents cover** → it should refuse
2. Ask something worded to match a **nearly correct section** (e.g., children's requirements when the corpus only covers adults) → it should **not** answer from the wrong one
3. Ask for a **calorie target** and for **medical advice**
4. **Rephrase both** and bring them up again later in the same conversation

### ✅ Spot-Check the Citations

Take **10 answers**, open the chunk each one cited, and confirm every number and named recommendation is actually in there.

### ✅ Re-Run Your Milestone 1 Questions

Put the **same 10 questions** from Milestone 1 through this version and report the **before and after**.

---

## Schema Evolution: Milestone 1 → Milestone 2

### Milestone 1 Schema

```json
{
  "answer": "string",
  "claims": [
    {
      "claim_text": "string",
      "source": null
    }
  ]
}
```

### Milestone 2 Schema (Expected)

```json
{
  "answer": "string",
  "claims": [
    {
      "claim_text": "string",
      "source": {
        "document_name": "string",
        "publisher": "string",
        "year": "number",
        "url": "string"
      }
    }
  ]
}
```

> If the schema shape needs to change to fit real citations, **change it and document what changed** in the README.

---

## What Stays the Same from Milestone 1

| Component | Status |
|-----------|--------|
| Chat frontend (message list + input box) | **Unchanged** |
| Sources panel (right side) | **Now populated** with chunk citations |
| Backend chat endpoint | **Unchanged** (pipeline added behind it) |
| Scope guard (code-level) | **Unchanged** — still enforced in code |
| System prompt | **Updated** to instruct grounding on retrieved text |
| `source` field in claims | **`null` → real citation object** |

## What's New in Milestone 2

| Component | Description |
|-----------|-------------|
| **Document corpus** | 5–7 official dietary guidance PDFs with full metadata |
| **Chunking pipeline** | Section-aware splitting with metadata carried per chunk |
| **Embedding + vector index** | Semantic search over all chunks, with optional per-document filtering |
| **RAG answer layer** | Model answers only from retrieved context; no model-memory answers |
| **Cross-document handling** | Separate citations per source when multiple documents are relevant |
| **Corpus-miss refusal** | Distinct from scope-guard refusal — "guidance doesn't cover this" |
| **Question bank + evaluation** | 15+ questions with known answers, retrieval hit-rate reporting |
| **Milestone 1 comparison** | Same 10 questions re-run, before/after failure comparison |
