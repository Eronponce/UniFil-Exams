import { NextRequest, NextResponse } from "next/server";
import { getExam, getExamVersion } from "@/lib/db/exams";
import { buildAnswerKeyMatrixCsv, buildAnswerKeyMatrixCsvFromSnapshot } from "@/lib/pdf/exam-csv";
import { parseExamVersionNumber } from "@/lib/exam/version";

export async function GET(req: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const requestedVersion = parseExamVersionNumber(new URL(req.url).searchParams.get("version"));
  if (requestedVersion === "invalid") return new NextResponse("Versão inválida", { status: 400 });

  const exam = getExam(Number(examId));
  if (!exam) return new NextResponse("Prova não encontrada", { status: 404 });

  const version = requestedVersion === undefined ? undefined : getExamVersion(exam.id, requestedVersion);
  if (requestedVersion !== undefined && !version) return new NextResponse("Versão não encontrada", { status: 404 });

  const csv = version
    ? buildAnswerKeyMatrixCsvFromSnapshot(version.snapshot)
    : buildAnswerKeyMatrixCsv(exam);
  const title = version?.snapshot.title ?? exam.title;
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `gabarito-${safeName}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
