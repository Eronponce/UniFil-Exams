import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getExam } from "@/lib/db/exams";
import { buildAnswerKeyCsv } from "@/lib/pdf/exam-csv";

interface SetRow { id: number; exam_id: number }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const row = getDb().prepare("SELECT id, exam_id FROM exam_sets WHERE id = ?").get(Number(setId)) as SetRow | undefined;
  if (!row) return new NextResponse("Set não encontrado", { status: 404 });

  const exam = getExam(row.exam_id);
  if (!exam) return new NextResponse("Prova não encontrada", { status: 404 });

  const set = exam.sets.find((s) => s.id === row.id);
  if (!set) return new NextResponse("Set não encontrado", { status: 404 });

  const csv = buildAnswerKeyCsv(exam.title, set);
  const safeName = exam.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `gabarito-${safeName}-set-${set.label.toLowerCase()}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
