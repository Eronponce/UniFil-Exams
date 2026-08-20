import { NextResponse } from "next/server";
import { parseExamVersionNumber } from "@/lib/exam/version";
import {
  loadCommentedAnswerKey,
  safeExportFilename,
} from "@/lib/export/commented-answer-key";
import { renderHtmlPageToPdfBuffer } from "@/lib/print/browser-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const numericSetId = Number(setId);
  if (!Number.isSafeInteger(numericSetId) || numericSetId <= 0) {
    return new NextResponse("Set inválido", { status: 400 });
  }

  const requestUrl = new URL(req.url);
  const requestedVersion = parseExamVersionNumber(requestUrl.searchParams.get("version"));
  if (requestedVersion === "invalid") {
    return new NextResponse("Versão inválida", { status: 400 });
  }

  const result = loadCommentedAnswerKey(numericSetId, requestedVersion);
  if (!result.ok) {
    if (result.reason === "exam") return new NextResponse("Prova não encontrada", { status: 404 });
    if (result.reason === "version") return new NextResponse("Versão não encontrada", { status: 404 });
    if (result.reason === "version-set") return new NextResponse("Set não encontrado na versão", { status: 404 });
    return new NextResponse("Set não encontrado", { status: 404 });
  }

  try {
    const printUrl = new URL(`/print/commented-answer-key/${numericSetId}`, req.url);
    if (requestedVersion !== undefined) {
      printUrl.searchParams.set("version", String(requestedVersion));
    }
    const pdf = await renderHtmlPageToPdfBuffer(printUrl.toString());
    const filename = `gabarito-comentado-${safeExportFilename(result.data.examTitle)}-set-${safeExportFilename(result.data.setLabel)}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
