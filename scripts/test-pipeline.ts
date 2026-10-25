// scripts/test-pipeline.ts
// End-to-end test for Phases 4–6
// Tests: scope guard, relevance gate, retrieval, full RAG pipeline

import { isBlocked } from "../lib/scopeGuard";
import { retrieveChunks } from "../lib/retriever";
import { relevanceGate } from "../lib/relevanceGate";
import { ragPipeline } from "../lib/ragPipeline";

// ── Colour helpers ────────────────────────────────────────────
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

function pass(label: string) { console.log(`  ${green("✓")} ${label}`); }
function fail(label: string) { console.log(`  ${red("✗")} ${label}`); }
function section(title: string) { console.log(`\n${bold(title)}`); }

const FAKE_SESSION = "test-session-000";

// ────────────────────────────────────────────────────────────────────────────
// PHASE 5 TEST: Scope Guard
// ────────────────────────────────────────────────────────────────────────────
function testScopeGuard() {
  section("Phase 5.1 — Scope Guard");

  const SHOULD_BLOCK = [
    "How many calories should I eat per day?",
    "How much should I weigh at 5'10?",
    "Should I take a supplement for my diabetes?",
    "What medication should I take for high cholesterol?",
  ];

  const SHOULD_ALLOW = [
    "How much protein does a vegetarian adult need?",
    "How long can cooked rice be stored?",
    "What temperature kills salmonella?",
    "What are good sources of dietary fibre?",
  ];

  let allOk = true;
  for (const q of SHOULD_BLOCK) {
    if (isBlocked(q)) { pass(`BLOCKED: "${q}"`); }
    else { fail(`Should have blocked: "${q}"`); allOk = false; }
  }
  for (const q of SHOULD_ALLOW) {
    if (!isBlocked(q)) { pass(`ALLOWED: "${q}"`); }
    else { fail(`Should have allowed: "${q}"`); allOk = false; }
  }
  return allOk;
}

// ────────────────────────────────────────────────────────────────────────────
// PHASE 4 TEST: Retrieval + Relevance Gate
// ────────────────────────────────────────────────────────────────────────────
async function testRetrieval() {
  section("Phase 4 & 5 — Retrieval + Relevance Gate");

  const RELEVANT_QUERIES = [
    "How much protein does an adult need per day?",
    "How long can I store cooked chicken in the fridge?",
    "What temperature should food be kept at to prevent bacteria?",
    "What proportion of diet should be fruits and vegetables?",
    "What is the recommended daily intake of sodium?",
  ];

  const OFF_TOPIC_QUERY = "What is the capital of France?";

  let allOk = true;

  // Test relevant queries
  for (const q of RELEVANT_QUERIES) {
    try {
      const t0 = Date.now();
      const chunks = await retrieveChunks({ query: q, k: 6 });
      const ms = Date.now() - t0;
      const gate = relevanceGate(chunks);

      if (!gate.pass) {
        fail(`Gate FAILED (no relevant chunks) for: "${q}"`);
        allOk = false;
        continue;
      }

      const top = gate.relevant_chunks[0];
      if (ms > 2000) {
        console.log(`  ${yellow("⚠")} Slow (${ms}ms): "${q}" → score=${top.similarity_score.toFixed(3)}, doc=${top.document_name}`);
      } else {
        pass(`${ms}ms | score=${top.similarity_score.toFixed(3)} | ${top.document_name.substring(0, 50)}`);
      }
    } catch (e: any) {
      fail(`Error for "${q}": ${e.message}`);
      allOk = false;
    }
  }

  // Test off-topic query → gate should fail
  try {
    const chunks = await retrieveChunks({ query: OFF_TOPIC_QUERY, k: 6 });
    const gate = relevanceGate(chunks);
    if (!gate.pass) {
      pass(`Corpus-miss correctly detected: "${OFF_TOPIC_QUERY}"`);
    } else {
      const top = gate.relevant_chunks[0];
      console.log(`  ${yellow("⚠")} Gate passed for off-topic query (score=${top.similarity_score.toFixed(3)}) — consider lowering threshold`);
    }
  } catch (e: any) {
    fail(`Error on off-topic query: ${e.message}`);
    allOk = false;
  }

  return allOk;
}

// ────────────────────────────────────────────────────────────────────────────
// PHASE 6 TEST: Full RAG Pipeline
// ────────────────────────────────────────────────────────────────────────────
async function testRagPipeline() {
  section("Phase 6 — Full RAG Pipeline (LLM call included)");

  const TEST_CASES: Array<{ query: string; expectBlocked?: true; expectMiss?: true }> = [
    { query: "What is the recommended daily intake of dietary fibre for adults?" },
    { query: "How long can cooked chicken be safely stored in the refrigerator?" },
    { query: "What are the main food groups recommended in the Eatwell Guide?" },
    { query: "How many calories should I eat per day?", expectBlocked: true },
    { query: "What is the best gaming laptop?", expectMiss: true },
  ];

  let allOk = true;

  for (const tc of TEST_CASES) {
    try {
      const t0 = Date.now();
      const result = await ragPipeline(tc.query, FAKE_SESSION);
      const ms = Date.now() - t0;

      if (tc.expectBlocked) {
        if (result.claims.length === 0 && result.answer.includes("not able")) {
          pass(`[${ms}ms] BLOCKED correctly: "${tc.query}"`);
        } else {
          fail(`Expected block, got answer: "${tc.query}"`);
          allOk = false;
        }
      } else if (tc.expectMiss) {
        if (result.claims.length === 0 && result.answer.includes("don't appear to cover")) {
          pass(`[${ms}ms] CORPUS-MISS correctly: "${tc.query}"`);
        } else {
          // Might still get an answer if corpus happens to be relevant enough
          console.log(`  ${yellow("⚠")} Expected corpus-miss but got answer (${ms}ms): "${tc.query.substring(0, 60)}"`);
        }
      } else {
        const hasAnswer = result.answer.length > 10;
        const hasClaims = result.claims.length > 0;
        if (hasAnswer && hasClaims) {
          pass(`[${ms}ms] ${result.claims.length} claims | "${result.answer.substring(0, 80)}..."`);
        } else {
          fail(`[${ms}ms] Missing answer or claims: "${tc.query}"`);
          allOk = false;
        }
      }
    } catch (e: any) {
      fail(`Error for "${tc.query}": ${e.message}`);
      allOk = false;
    }
  }

  return allOk;
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(bold("\n=== Nutrition Bot — Pipeline Test Suite (Phases 4–6) ===\n"));

  const sgOk = testScopeGuard();
  const retOk = await testRetrieval();

  console.log(`\n${dim("──── Full RAG pipeline requires GROQ_API_KEY and running services ────")}`);
  const groqKey = process.env.GROQ_API_KEY;
  let ragOk = true;
  if (!groqKey) {
    console.log(`  ${yellow("⚠")}  GROQ_API_KEY not set — skipping LLM tests`);
    console.log(`     Set it and re-run to test the full pipeline.`);
  } else {
    ragOk = await testRagPipeline();
  }

  // Summary
  console.log(`\n${bold("── Summary ──")}`);
  console.log(`  Scope Guard:   ${sgOk ? green("PASS") : red("FAIL")}`);
  console.log(`  Retrieval:     ${retOk ? green("PASS") : red("FAIL")}`);
  console.log(`  RAG Pipeline:  ${groqKey ? (ragOk ? green("PASS") : red("FAIL")) : yellow("SKIPPED (no API key)")}`);
  console.log();
}

main().catch((e) => { console.error(red("Fatal:"), e); process.exit(1); });
