import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { findDocumentByIdOrName } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("id") || searchParams.get("name") || "";

    if (!query) {
      return new NextResponse("Missing ?id= or ?name= query parameter", { status: 400 });
    }

    const found = findDocumentByIdOrName(query);

    if (!found.filePath || !fs.existsSync(found.filePath)) {
      return new NextResponse(`Document "${query}" could not be found in corpus repository.`, {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const fileBuffer = fs.readFileSync(found.filePath);
    const filename = found.metadata?.filename || "document.pdf";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": found.mimeType || "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (err: unknown) {
    console.error("[/api/documents]", err);
    return new NextResponse("Internal Server Error retrieving document", { status: 500 });
  }
}
