// lib/schema.ts
import { z } from "zod";

export const CitationSchema = z.object({
  document_name: z.string().min(1).catch("Dietary Guidelines"),
  publisher: z.string().min(1).catch("Health Authority"),
  year: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const num = typeof v === "number" ? v : parseInt(v, 10);
      return isNaN(num) ? 2020 : num;
    })
    .catch(2020),
  url: z.string().catch(""),
  section: z.string().min(1).catch("General"),
});

export type Citation = z.infer<typeof CitationSchema>;

export const ClaimSchema = z.preprocess((val: any) => {
  if (typeof val === "object" && val !== null) {
    const claim_text =
      val.claim_text ?? val.claim ?? val.text ?? val.statement ?? "";
    return { ...val, claim_text };
  }
  return val;
}, z.object({
  claim_text: z.string().min(1),
  source: CitationSchema,
}));

export type Claim = z.infer<typeof ClaimSchema>;

export const ChatResponseSchema = z.object({
  answer: z.string().min(1),
  claims: z.array(ClaimSchema).default([]),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;
