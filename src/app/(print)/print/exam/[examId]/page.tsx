export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getExam, getExamVersion, hasExamVersions } from "@/lib/db/exams";
import { buildPrintExamPayload } from "@/lib/print/build-print-payload";
import { ExamPrintClient } from "@/components/print/exam-print-client";
import { parseQuestionImageScale } from "@/lib/print/question-image-scale";

export default async function PrintExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ version?: string; imageScale?: string }>;
}) {
  const { examId } = await params;
  const sp = await searchParams;
  const exam = getExam(Number(examId));
  if (!exam || exam.sets.length === 0) notFound();

  let versionNumber: number | undefined;
  if (sp.version !== undefined) {
    if (!/^\d+$/.test(sp.version)) notFound();
    versionNumber = Number(sp.version);
    if (!Number.isSafeInteger(versionNumber) || versionNumber <= 0) notFound();
  }
  const version = getExamVersion(exam.id, versionNumber);
  if ((sp.version !== undefined || hasExamVersions(exam.id)) && !version) notFound();

  return (
    <ExamPrintClient
      payload={buildPrintExamPayload(exam, version)}
      mode="exam"
      initialImageScaleOverrides={parseQuestionImageScale(sp.imageScale)}
    />
  );
}
