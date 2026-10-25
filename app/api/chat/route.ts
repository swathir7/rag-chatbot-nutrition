import { NextRequest, NextResponse } from "next/server";
import { ragPipeline } from "@/lib/ragPipeline";
import { createSession, sessionExists, saveMessages } from "@/lib/db";
import { checkPreRetrieval } from "@/lib/scopeGuard";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  let resolvedSessionId: string | null = null;
  let userMessage = "";

  try {
    const body = await req.json();
    const { session_id: incomingSessionId, message } = body as {
      session_id?: string | null;
      message?: unknown;
    };

    // Validate input
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Missing message" },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    userMessage = message.trim();

    // ── Session resolution ──────────────────────────────────
    resolvedSessionId =
      incomingSessionId && sessionExists(incomingSessionId)
        ? incomingSessionId
        : createSession();

    // ── Run full RAG pipeline (Phases 3-6) ──────────────────
    const result = await ragPipeline(userMessage, resolvedSessionId);

    // ── Persist (sync) ──────────────────────────────────────
    saveMessages(resolvedSessionId, userMessage, result);

    return NextResponse.json(
      { session_id: resolvedSessionId, ...result },
      { headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    console.error("[/api/chat] Handled error:", err);

    // Construct a safe, framed denying answer instead of throwing 500
    const preDenial = userMessage ? checkPreRetrieval(userMessage) : null;
    let fallbackAnswer = preDenial?.answer;

    if (!fallbackAnswer) {
      if (/\b(fish|dogs?|cats?|pets?|animals?|birds?)\b/i.test(userMessage)) {
        fallbackAnswer =
          "I cannot provide dietary advice for fish, pets, or animals. I am strictly an AI dietary guidance assistant dedicated to human nutrition and food safety based on official public health guidelines. Please consult a qualified veterinarian or aquatic pet specialist.";
      } else {
        fallbackAnswer =
          "I cannot answer this question. As an AI assistant dedicated solely to human nutrition and food safety, I can only provide guidance grounded in official public health guidelines (such as USDA, WHO, and EFSA). I cannot answer non-human dietary questions, personal calorie targets, or off-topic queries.";
      }
    }

    const fallbackResponse = {
      session_id: resolvedSessionId || createSession(),
      answer: fallbackAnswer,
      claims: [],
    };

    if (resolvedSessionId && userMessage) {
      try {
        saveMessages(resolvedSessionId, userMessage, fallbackResponse);
      } catch {
        // ignore persistence failure on fallback
      }
    }

    return NextResponse.json(fallbackResponse, { headers: CORS_HEADERS });
  }
}
