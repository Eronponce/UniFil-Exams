export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getExam } from "@/lib/db/exams";
import { buildPrintExamPayload } from "@/lib/print/build-print-payload";
import { ExamPrintClient } from "@/components/print/exam-print-client";

export default async function PrintExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = getExam(Number(examId));
  if (!exam || exam.sets.length === 0) notFound();

  return <ExamPrintClient payload={buildPrintExamPayload(exam)} mode="exam" />;
}
