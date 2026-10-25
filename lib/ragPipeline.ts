// lib/ragPipeline.ts
// Phase 6 — Full RAG orchestration
// Flow: scope guard → retrieve → relevance gate → prompt → LLM → parse → return

import { checkPreRetrieval } from "./scopeGuard";
import { retrieveChunks } from "./retriever";
import { relevanceGate, buildCorpusMissResponse } from "./relevanceGate";
import { buildPrompt } from "./promptBuilder";
import { getHistory } from "./db";
import Groq from "groq-sdk";
import { ChatResponseSchema, type ChatResponse } from "./schema";

// ── Groq client ──────────────────────────────────────────────────────────────

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set.");
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

// ── JSON cleanup helper ───────────────────────────────────────────────────────

function cleanJson(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return cleaned;
}

// ── LLM call with retry & rate limit backoff ─────────────────────────────────

async function groqCreateWithBackoff(
  params: Parameters<Groq["chat"]["completions"]["create"]>[0],
  maxRetries = 2
): Promise<Groq.Chat.ChatCompletion> {
  const groq = getGroqClient();
  let delay = 1500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return (await groq.chat.completions.create({
        ...params,
        stream: false,
      })) as Groq.Chat.ChatCompletion;
    } catch (err: any) {
      const isRateLimit =
        err?.status === 429 ||
        /rate limit|429/i.test(err?.message || "");
      if (isRateLimit && attempt < maxRetries) {
        console.warn(`[ragPipeline] Groq rate limit hit. Waiting ${delay}ms before retry ${attempt + 1}...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Groq API call failed after retries.");
}

async function callLLM(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ChatResponse> {
  let completion;
  try {
    completion = await groqCreateWithBackoff({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.2,
      max_tokens: 1024,
    });
  } catch (err: any) {
    console.error("[ragPipeline] Groq API call error:", err?.message || err);
    if (err?.status === 429 || /rate limit|429/i.test(err?.message || "")) {
      return {
        answer:
          "I am temporarily experiencing high traffic on my guidance service. Please wait a few moments and try your question again.",
        claims: [],
      };
    }
    return {
      answer:
        "I'm having trouble processing that question right now. Please rephrase or try again in a moment.",
      claims: [],
    };
  }

  const raw = completion.choices[0]?.message?.content ?? "";

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch {
    console.warn(`[ragPipeline] Non-JSON response received: "${raw.slice(0, 200)}"`);
    return {
      answer:
        cleanJson(raw) ||
        "I could not formulate a structured answer for that query. Please ask a specific nutrition or food safety question.",
      claims: [],
    };
  }

  // Validate with Zod
  const validated = ChatResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn(`[ragPipeline] LLM schema mismatch. Retrying... Error: ${validated.error.message}`);
    
    try {
      const retryPrompt = systemPrompt + `\n\nCRITICAL FIX: Your previous response did not match the expected format. Ensure "claims" contains objects with "claim_text" and "source". Error: ${validated.error.message}`;
      
      const retryCompletion = await groqCreateWithBackoff({
        model: MODEL,
        messages: [
          { role: "system", content: retryPrompt },
          ...messages,
        ],
        temperature: 0.1,
        max_tokens: 1024,
      });
      
      const retryRaw = retryCompletion.choices[0]?.message?.content ?? "";
      let retryParsed: unknown;
      try {
        retryParsed = JSON.parse(cleanJson(retryRaw));
      } catch {
        return {
          answer:
            "I could not formulate a verified response for that query. Please ask a specific question based on official dietary guidance.",
          claims: [],
        };
      }
      
      const retryValidated = ChatResponseSchema.safeParse(retryParsed);
      if (!retryValidated.success) {
        return {
          answer: (retryParsed as any)?.answer || "Please rephrase your question regarding nutrition, food safety, or dietary guidelines.",
          claims: [],
        };
      }
      
      return retryValidated.data;
    } catch {
      return {
        answer: "I am temporarily experiencing high traffic. Please wait a few seconds and try your question again.",
        claims: [],
      };
    }
  }

  return validated.data;
}

// ── Main RAG pipeline ────────────────────────────────────────────────────────

export async function ragPipeline(
  message: string,
  sessionId: string
): Promise<ChatResponse> {
  // Step 1: Pre-retrieval triage and scope guard (no vector search wasted on meta, off-topic, emergency, or hostile queries)
  const preResponse = checkPreRetrieval(message);
  if (preResponse) {
    return preResponse;
  }

  // Step 2: Retrieve top-k chunks from Chroma
  const k = parseInt(process.env.RETRIEVAL_K ?? "3");
  const chunks = await retrieveChunks({ query: message, k });

  // Step 3: Relevance gate (post-retrieval — no LLM call wasted)
  const gate = relevanceGate(chunks);
  if (!gate.pass) {
    return buildCorpusMissResponse(gate.searched_documents);
  }

  // Step 4: Build prompt with retrieved context
  // Only pass the last 4 messages, extracting text/answer to avoid inflating token count
  const history = getHistory(sessionId).slice(-4).map((m) => {
    let content = m.content;
    try {
      const p = JSON.parse(m.content);
      content = p.text ?? p.answer ?? m.content;
    } catch {
      // not JSON
    }
    return {
      role: m.role as "user" | "assistant",
      content,
    };
  });

  const { systemPrompt, messages } = buildPrompt(
    gate.relevant_chunks,
    history,
    message
  );

  // Step 5 & 6: LLM call + Zod parse
  const response = await callLLM(systemPrompt, messages);

  // If answer indicates refusal, out of scope, or no information in documents, ensure claims is empty
  const refusalPatterns = [
    /do not contain (?:any )?information/i,
    /does not contain (?:any )?information/i,
    /don't appear to cover/i,
    /doesn't appear to cover/i,
    /no information (?:is )?(?:provided|found|available)/i,
    /cannot answer/i,
    /cannot provide/i,
    /not able to provide/i,
    /not covered in the/i,
    /outside (?:the )?scope/i,
    /cannot help (?:you )?(?:locate|find|with)/i,
    /cannot engage with threats/i,
    /emergency \/ safety warning/i,
    /safety warning/i,
    /do not drink seawater/i,
    /strictly bounded to answer questions/i,
    /only provide dietary and food safety guidance for human/i,
    /cannot answer hypothetical/i,
    /inedible/i,
    /hazardous/i,
    /dedicated solely to/i,
    /I am an AI dietary guidance assistant/i,
  ];

  const isDeclinedOrNoInfo = refusalPatterns.some((pattern) => pattern.test(response.answer));

  if (isDeclinedOrNoInfo) {
    response.claims = [];
  } else {
    // Only keep claims with valid, non-empty sources and positive factual content
    response.claims = (response.claims || []).filter((claim) => {
      if (!claim || !claim.claim_text || !claim.source || !claim.source.document_name) {
        return false;
      }
      if (/does not contain|do not contain|not mentioned|no information|cannot be found/i.test(claim.claim_text)) {
        return false;
      }
      return true;
    });

    // Ensure every claim has a valid local source document URL
    for (const claim of response.claims) {
      if (claim.source) {
        const matchingChunk = gate.relevant_chunks.find(
          (c) =>
            c.document_name.toLowerCase() === claim.source.document_name.toLowerCase() ||
            claim.source.document_name.toLowerCase().includes(c.document_name.toLowerCase()) ||
            c.document_name.toLowerCase().includes(claim.source.document_name.toLowerCase())
        );

        if (matchingChunk) {
          claim.source.url = matchingChunk.source_url || `/api/documents/${matchingChunk.doc_id}`;
          claim.source.document_name = matchingChunk.document_name;
          claim.source.publisher = matchingChunk.publisher;
          claim.source.year = matchingChunk.year;
        } else if (!claim.source.url || claim.source.url.includes("example.com")) {
          claim.source.url = `/api/documents?name=${encodeURIComponent(claim.source.document_name)}`;
        }
      }
    }

    // Enforce mandatory medical advice disclaimer on all advisory nutrition responses
    const hasMedicalDisclaimer = /doctor|dietitian|dietician|physician/i.test(response.answer);
    if (!hasMedicalDisclaimer) {
      response.answer =
        response.answer.trim() +
        "\n\nDisclaimer: All dietary and medical advice should be checked with a qualified doctor or registered dietitian.";
    }
  }

  return response;
}
