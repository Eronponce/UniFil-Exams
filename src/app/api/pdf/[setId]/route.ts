import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getExam } from "@/lib/db/exams";
import { renderHtmlPageToPdfBuffer } from "@/lib/print/browser-pdf";
import { parseQuestionImageScale, serializeQuestionImageScaleForForwarding } from "@/lib/print/question-image-scale";

interface SetRow {
  id: number;
  exam_id: number;
  label: string;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const requestUrl = new URL(req.url);
  const serializedImageScale = serializeQuestionImageScaleForForwarding(
    parseQuestionImageScale(requestUrl.searchParams.get("imageScale")),
  );
  const row = getDb()
    .prepare("SELECT id, exam_id, label FROM exam_sets WHERE id = ?")
    .get(Number(setId)) as SetRow | undefined;
  if (!row) return new NextResponse("Set nao encontrado", { status: 404 });

  const exam = getExam(row.exam_id);
  if (!exam) return new NextResponse("Prova nao encontrada", { status: 404 });

  try {
    const printUrl = new URL(`/print/set/${setId}`, req.url);
    if (serializedImageScale) printUrl.searchParams.set("imageScale", serializedImageScale);
    const pdf = await renderHtmlPageToPdfBuffer(printUrl.toString());
    const safeName = exam.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `prova-${exam.id}`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-set-${row.label.toLowerCase()}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
