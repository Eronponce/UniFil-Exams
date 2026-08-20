export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getExam } from "@/lib/db/exams";
import { buildPrintExamPayload } from "@/lib/print/build-print-payload";
import { ExamPrintClient } from "@/components/print/exam-print-client";
import { parseQuestionImageScale } from "@/lib/print/question-image-scale";

interface SetRow {
  id: number;
  exam_id: number;
}

export default async function PrintSetPage({
  params,
  searchParams,
}: {
  params: Promise<{ setId: string }>;
  searchParams: Promise<{ imageScale?: string }>;
}) {
  const { setId } = await params;
  const sp = await searchParams;
  const row = getDb()
    .prepare("SELECT id, exam_id FROM exam_sets WHERE id = ?")
    .get(Number(setId)) as SetRow | undefined;
  if (!row) notFound();

  const exam = getExam(row.exam_id);
  if (!exam) notFound();

  return (
    <ExamPrintClient
      payload={buildPrintExamPayload(exam)}
      mode="set"
      setId={row.id}
      initialImageScaleOverrides={parseQuestionImageScale(sp.imageScale)}
    />
  );
}
