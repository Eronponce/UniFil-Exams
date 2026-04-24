import { NextResponse } from "next/server";
import { getExam } from "@/lib/db/exams";
import { renderExamPdf } from "@/lib/pdf/exam-pdf";

function slugFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "prova";
}

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = getExam(Number(examId));
  if (!exam) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  if (exam.sets.length === 0) return NextResponse.json({ error: "Prova sem sets" }, { status: 400 });

  const pdf = await renderExamPdf(exam);
  const filename = `${slugFilename(exam.title)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
