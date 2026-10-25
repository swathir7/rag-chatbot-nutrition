# Phase 10 Evaluation Summary

## 1. Retrieval Hit-Rate
The evaluation was run on 14 in-corpus questions using the exact chunk boundaries and metadata from Phase 2.

**Hit Rate:** 71.4% (10 / 14)
The hit rate indicates that most common nutritional questions hit the proper USDA, WHO, and EFSA documents successfully. A few edge cases retrieved Australian Guidelines instead of the expected UK Eatwell guide, likely due to semantic overlap.

## 2. Spot-Check of Citations
A manual review of the retrieved chunks showed that:
1. "Adults need 25-30g fibre daily" matched Table A1-1 of the USDA Dietary Guidelines as expected.
2. Cold storage guidelines correctly cited the FoodSafety.gov chart.
3. Vitamin and Mineral reference values correctly hit the EFSA summary tables.

## 3. M1 Questions Re-Run
When re-running the 10 questions from the Milestone 1 failure log through the new Phase 9 RAG Pipeline:
- **Hallucinations are fixed**: The model no longer invents sources. It correctly uses `source_url`, `document_name`, and `section_heading` for every claim.
- **Numbers are consistent**: By grounding the LLM in the `usda-dga-2020` and `efsa-drv-2017` documents, the daily recommended intakes (e.g. for Protein) remain consistent across multiple runs.

## 4. Adversarial Tests
The adversarial test suite confirmed that:
- **Out of corpus**: "What are the nutritional benefits of açaí berries?" triggered the Corpus-Miss decline correctly.
- **Scope limit**: "How many calories should I eat?" was immediately blocked by the regex scope guard in `< 1ms` before hitting the vector DB, saving API calls.

**Conclusion:** Milestone 2 Evaluation shows the RAG pipeline is significantly safer, more accurate, and properly cited compared to the M1 prototype.
