import { NextRequest, NextResponse } from "next/server";
import { parseExamVersionNumber } from "@/lib/exam/version";
import { renderAnswerKeyPng } from "@/lib/export/answer-key-image";
import {
  loadCommentedAnswerKey,
  safeExportFilename,
} from "@/lib/export/commented-answer-key";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const numericSetId = Number(setId);
  if (!Number.isSafeInteger(numericSetId) || numericSetId <= 0) {
    return new NextResponse("Set inválido", { status: 400 });
  }

  const requestedVersion = parseExamVersionNumber(req.nextUrl.searchParams.get("version"));
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

  const { data } = result;
  const png = await renderAnswerKeyPng({
    examTitle: data.examTitle,
    institution: data.institution,
    setLabel: data.setLabel,
    versionNumber: data.versionNumber,
    questions: data.questions,
  });
  const filename = `gabarito-comentado-${safeExportFilename(data.examTitle)}-set-${safeExportFilename(data.setLabel)}.png`;

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(png.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
