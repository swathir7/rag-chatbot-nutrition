// scripts/test-retrieval.ts
import { retrieveChunks } from "../lib/retriever";

async function main() {
  const query = "How much protein does an adult need per day?";
  console.log(`\nTesting Retrieval for query: "${query}"\n`);
  
  try {
    const startTime = Date.now();
    const chunks = await retrieveChunks({ query, k: 3 });
    const endTime = Date.now();
    
    console.log(`Retrieved ${chunks.length} chunks in ${endTime - startTime}ms:\n`);
    
    chunks.forEach((c, i) => {
      console.log(`[Result ${i + 1}] Score: ${c.similarity_score.toFixed(4)}`);
      console.log(`Document: ${c.document_name} (${c.year})`);
      console.log(`Section: ${c.section_heading}`);
      console.log(`Source URL: ${c.source_url}`);
      console.log(`Content snippet: ${c.content.substring(0, 150)}...\n`);
    });
  } catch (err) {
    console.error("Retrieval test failed:");
    console.error(err);
  }
}

main();
