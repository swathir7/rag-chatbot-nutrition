import { NextRequest, NextResponse } from "next/server";
import { getSessionMessages, getAllSessions, sessionExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (sessionId) {
      if (!sessionExists(sessionId)) {
        return NextResponse.json(
          { error: "Session not found", messages: [] },
          { status: 404, headers: CORS_HEADERS }
        );
      }
      const messages = getSessionMessages(sessionId);
      return NextResponse.json({ session_id: sessionId, messages }, { headers: CORS_HEADERS });
    }

    const rawLimit = parseInt(searchParams.get("limit") || "150", 10);
    const limit = isNaN(rawLimit) || rawLimit <= 0 ? 150 : Math.min(rawLimit, 150);
    const sessions = getAllSessions(limit);
    return NextResponse.json({ sessions }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error("[/api/history]", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch history" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
