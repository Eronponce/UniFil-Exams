import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getExam } from "@/lib/db/exams";
import { renderExamPdf } from "@/lib/pdf/exam-pdf";

interface SetRow { id: number; exam_id: number }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const row = getDb().prepare("SELECT id, exam_id FROM exam_sets WHERE id = ?").get(Number(setId)) as SetRow | undefined;
  if (!row) return new NextResponse("Set não encontrado", { status: 404 });

  const exam = getExam(row.exam_id);
  if (!exam) return new NextResponse("Prova não encontrada", { status: 404 });

  const set = exam.sets.find((s) => s.id === row.id);
  if (!set) return new NextResponse("Set não encontrado", { status: 404 });

  const pdf = await renderExamPdf(exam);
  const filename = `prova-${exam.title.replace(/[^a-z0-9]/gi, "_")}-set-${set.label}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
