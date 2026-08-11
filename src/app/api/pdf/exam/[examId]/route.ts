import { NextResponse } from "next/server";
import { getExam, getExamVersion } from "@/lib/db/exams";
import { renderHtmlPageToPdfBuffer } from "@/lib/print/browser-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const requestedVersion = new URL(req.url).searchParams.get("version");
  const exam = getExam(Number(examId));
  if (!exam) return NextResponse.json({ error: "Prova nao encontrada" }, { status: 404 });
  if (exam.sets.length === 0) return NextResponse.json({ error: "Prova sem sets" }, { status: 400 });
  let selectedVersionTitle: string | undefined;
  if (requestedVersion !== null) {
    const versionNumber = /^\d+$/.test(requestedVersion) ? Number(requestedVersion) : NaN;
    if (!Number.isSafeInteger(versionNumber) || versionNumber <= 0) {
      return NextResponse.json({ error: "Versao invalida" }, { status: 400 });
    }
    const version = getExamVersion(exam.id, versionNumber);
    if (!version) {
      return NextResponse.json({ error: "Versao nao encontrada" }, { status: 404 });
    }
    selectedVersionTitle = version.snapshot.title;
  }

  try {
    const printUrl = new URL(`/print/exam/${examId}`, req.url);
    if (requestedVersion !== null) printUrl.searchParams.set("version", requestedVersion);
    const pdf = await renderHtmlPageToPdfBuffer(printUrl.toString());
    const safeName = (selectedVersionTitle ?? exam.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `prova-${exam.id}`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
