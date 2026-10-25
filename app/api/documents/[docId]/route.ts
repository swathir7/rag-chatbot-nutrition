import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { findDocumentByIdOrName } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId: rawDocId } = await context.params;
    const docId = decodeURIComponent(rawDocId || "").trim();

    if (!docId) {
      return new NextResponse("Document ID parameter missing", { status: 400 });
    }

    const found = findDocumentByIdOrName(docId);

    if (!found.filePath || !fs.existsSync(found.filePath)) {
      return new NextResponse(`Document "${docId}" could not be found in corpus repository.`, {
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
    console.error("[/api/documents/[docId]]", err);
    return new NextResponse("Internal Server Error retrieving document", { status: 500 });
  }
}
