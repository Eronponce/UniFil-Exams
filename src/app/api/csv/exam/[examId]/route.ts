import { NextRequest, NextResponse } from "next/server";
import { getExam } from "@/lib/db/exams";
import { buildAnswerKeyMatrixCsv } from "@/lib/pdf/exam-csv";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = getExam(Number(examId));
  if (!exam) return new NextResponse("Prova não encontrada", { status: 404 });

  const csv = buildAnswerKeyMatrixCsv(exam);
  const safeName = exam.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `gabarito-${safeName}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
