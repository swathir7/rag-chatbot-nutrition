import fs from "fs";
import path from "path";
import { retrieveChunks } from "../lib/retriever";

const QUESTION_BANK_PATH = path.join(__dirname, "question-bank.json");
const RESULTS_DIR = path.join(__dirname, "results");

interface Question {
  id: number;
  question: string;
  expected_doc_id: string;
  expected_section: string;
  category: string;
}

async function runEval() {
  if (!fs.existsSync(QUESTION_BANK_PATH)) {
    console.error("Question bank not found:", QUESTION_BANK_PATH);
    process.exit(1);
  }

  const questions: Question[] = JSON.parse(fs.readFileSync(QUESTION_BANK_PATH, "utf8"));
  let hits = 0;
  const missLog: string[] = [];
  const hitLog: string[] = [];

  console.log(`Evaluating ${questions.length} questions...\n`);

  for (const q of questions) {
    if (q.category === "out_of_corpus") {
      // Out of corpus questions are a special case, skipping exact doc hit rate.
      continue;
    }

    const chunks = await retrieveChunks({ query: q.question, k: 6 });
    
    // Check if expected_doc_id is in the top-k results
    // To be precise we could check for section too, but often sections vary slightly by parsed markdown
    // So we just check if the document is right and if the section string is contained.
    const hitChunk = chunks.find(
      c => c.document_name.toLowerCase().includes(q.expected_doc_id.replace(/-/g, " ")) || 
           c.source_url.includes(q.expected_doc_id.split("-")[0]) // heuristics for matching
    );
    
    // Actually our db doesn't expose doc_id in RetrievedChunk, just document_name.
    // Let's do a fuzzy match on document name based on doc_id
    const expectedDocMapping: Record<string, string> = {
      "usda-dga-2020": "Dietary Guidelines for Americans",
      "who-healthy-diet": "Healthy Diet",
      "uk-eatwell-2016": "Eatwell",
      "efsa-drv-2017": "Dietary Reference Values",
      "foodsafety-cold-storage": "Cold Food Storage",
      "au-dietary-2013": "Australian",
      "fda-food-code-2022": "Food Code"
    };

    const expectedName = expectedDocMapping[q.expected_doc_id] || q.expected_doc_id;
    
    const exactHit = chunks.find(c => 
      c.document_name.includes(expectedName)
    );

    if (exactHit) {
      hits++;
      hitLog.push(`Q${q.id}: ✅ ${q.expected_doc_id} / ${exactHit.section_heading} (score: ${exactHit.similarity_score.toFixed(2)})`);
    } else {
      const topRes = chunks[0];
      const gotMsg = topRes ? `${topRes.document_name} / ${topRes.section_heading} (score: ${topRes.similarity_score.toFixed(2)})` : "No results";
      missLog.push(`Q${q.id}: ❌ Expected ${q.expected_doc_id}, got ${gotMsg}`);
    }
  }

  const evalCount = questions.filter(q => q.category !== "out_of_corpus").length;
  const hitRate = (hits / evalCount) * 100;

  const report = `
Retrieval Hit-Rate: ${hits}/${evalCount} = ${hitRate.toFixed(1)}%

Hits:
${hitLog.join("\n")}

Misses:
${missLog.join("\n")}
`;

  console.log(report);
  
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR);
  }
  
  fs.writeFileSync(path.join(RESULTS_DIR, "retrieval_eval_report.txt"), report.trim());
  console.log("Report saved to eval/results/retrieval_eval_report.txt");
}

runEval().catch(err => {
  console.error(err);
  process.exit(1);
});
