
import fs from "fs";
import path from "path";
import { ragPipeline } from "../lib/ragPipeline";

const M1_QUESTIONS_PATH = path.join(__dirname, "milestone1-questions.json");
const RESULTS_DIR = path.join(__dirname, "results");

async function runM1Comparison() {
  const questions: { id: number, question: string }[] = JSON.parse(fs.readFileSync(M1_QUESTIONS_PATH, "utf8"));
  
  console.log(`Running M1 Comparison on ${questions.length} questions...\n`);
  
  let report = "# M1 vs M2 Comparison\n\n";

  for (const q of questions) {
    try {
      const response = await ragPipeline(q.question, "eval-m1-" + q.id);
      
      const claimsStr = response.claims.map(c => 
        `- ${c.claim_text} (Source: ${c.source ? c.source.document_name : 'null'})`
      ).join("\n");
      
      report += `## Q${q.id}: ${q.question}\n`;
      report += `**M2 Answer:** ${response.answer}\n`;
      report += `**M2 Claims:**\n${claimsStr}\n\n`;
      
      console.log(`✅ Q${q.id} completed.`);
    } catch (e: any) {
      console.log(`❌ Q${q.id} failed: ${e.message}`);
      report += `## Q${q.id}: ${q.question}\n**Error:** ${e.message}\n\n`;
    }
  }

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR);
  }
  
  fs.writeFileSync(path.join(RESULTS_DIR, "m1_comparison_report.md"), report.trim());
  console.log("Report saved to eval/results/m1_comparison_report.md");
}

runM1Comparison().catch(console.error);
