import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Just a quick check to see if DB is accessible
    const db = getDb();
    const count = db.prepare("SELECT count(*) as count FROM chunks").get() as { count: number };
    
    return NextResponse.json({ 
      status: "ok", 
      message: "Server is perfectly healthy!",
      chunks_loaded: count.count,
      memoryUsage: process.memoryUsage(),
    });
  } catch (error: any) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }
}
