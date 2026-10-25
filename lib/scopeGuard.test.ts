// lib/scopeGuard.test.ts
// Phase 3 — manual test runner for the scope guard
// Run with: npx tsx lib/scopeGuard.test.ts

import { isBlocked, checkPreRetrieval } from "./scopeGuard";

const SHOULD_BLOCK: string[] = [
  "What's my daily calorie target?",
  "How many calories should I eat?",
  "How do I lose weight fast?",
  "Should I weigh 65kg?",
  "What's a good diet plan for weight loss?",
  "Can you diagnose my condition?",
  "What supplement dose should I take?",
  // Sideways variants
  "How much should I eat in a day?",
  "Tell me my energy intake target",
  "My goal is to get to 60kg, what should I eat?",
];

const SHOULD_PASS: string[] = [
  "What is vitamin C?",
  "How much iron does spinach have?",
  "Is raw chicken safe to eat?",
  "How does fermentation preserve food?",
  "What does vitamin B12 do?",
  "Is it safe to refreeze thawed meat?",
];

const SMART_DENIAL_TESTS: Array<{ query: string; expectedKeyword: string }> = [
  { query: "what you can do", expectedKeyword: "dietary guidance assistant" },
  { query: "where is my wallet", expectedKeyword: "personal belongings" },
  { query: "what is your official documents", expectedKeyword: "Healthy Diet Fact Sheet (WHO, 2024)" },
  { query: "can only answer questions addressed in these official guidance documents.", expectedKeyword: "official dietary guidance documents" },
  { query: "i eat nothing since morning, i dont have water i am on island, i drink sea water daily, i am about to die due to dehydration.", expectedKeyword: "Do NOT drink seawater" },
  { query: "i will born again then kill you.", expectedKeyword: "threats of violence" },
  { query: "Seawater good for aliens?", expectedKeyword: "human nutrition" },
  { query: "Can vampires eat garlic bread?", expectedKeyword: "human nutrition" },
  { query: "What should I feed my cat?", expectedKeyword: "human nutrition" },
  { query: "cAN FISH DRINK MANGO FROOTI?", expectedKeyword: "human nutrition" },
  { query: "Is mango frooti good for fish?", expectedKeyword: "human nutrition" },
  { query: "Can I drink motor oil?", expectedKeyword: "inedible" },
];

let failures = 0;

SHOULD_BLOCK.forEach((q) => {
  if (!isBlocked(q)) {
    console.error(`❌ SHOULD have been blocked: "${q}"`);
    failures++;
  } else {
    console.log(`✅ Blocked: "${q}"`);
  }
});

SHOULD_PASS.forEach((q) => {
  if (isBlocked(q)) {
    console.error(`❌ Should NOT have been blocked: "${q}"`);
    failures++;
  } else {
    console.log(`✅ Passed through: "${q}"`);
  }
});

// Test checkPreRetrieval smart handling & denials
SMART_DENIAL_TESTS.forEach(({ query, expectedKeyword }) => {
  const res = checkPreRetrieval(query);
  if (!res) {
    console.error(`❌ checkPreRetrieval failed to intercept: "${query}"`);
    failures++;
  } else if (!res.answer.toLowerCase().includes(expectedKeyword.toLowerCase())) {
    console.error(`❌ checkPreRetrieval answer missing expected keyword "${expectedKeyword}": "${res.answer}"`);
    failures++;
  } else if (res.claims.length !== 0) {
    console.error(`❌ checkPreRetrieval claims should be empty, got ${res.claims.length}`);
    failures++;
  } else {
    console.log(`✅ Smartly intercepted: "${query}" → contains "${expectedKeyword}"`);
  }
});

// Verify pass-through queries are NOT intercepted by checkPreRetrieval
SHOULD_PASS.forEach((q) => {
  const res = checkPreRetrieval(q);
  if (res !== null) {
    console.error(`❌ checkPreRetrieval incorrectly intercepted nutrition query: "${q}"`);
    failures++;
  } else {
    console.log(`✅ Correctly not intercepted (passes to retrieval): "${q}"`);
  }
});

console.log(`\nScope guard & smart denial tests done. ${failures === 0 ? "All passed ✅" : `${failures} failure(s) ❌`}`);
process.exit(failures > 0 ? 1 : 0);

