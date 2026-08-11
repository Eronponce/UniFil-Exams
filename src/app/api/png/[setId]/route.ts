import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { getExam, getExamVersion } from "@/lib/db/exams";
import { getQuestion } from "@/lib/db/questions";
import { parseExamVersionNumber } from "@/lib/exam/version";
import {
  renderAnswerKeyPng,
  type AnswerKeyImageQuestion,
} from "@/lib/export/answer-key-image";

export const runtime = "nodejs";

interface SetRow {
  id: number;
  exam_id: number;
}

function safeFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "prova";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const numericSetId = Number(setId);
  if (!Number.isSafeInteger(numericSetId) || numericSetId <= 0) {
    return new NextResponse("Set inválido", { status: 400 });
  }

  const requestedVersion = parseExamVersionNumber(req.nextUrl.searchParams.get("version"));
  if (requestedVersion === "invalid") {
    return new NextResponse("Versão inválida", { status: 400 });
  }

  const row = getDb().prepare("SELECT id, exam_id FROM exam_sets WHERE id = ?").get(numericSetId) as SetRow | undefined;
  if (!row) return new NextResponse("Set não encontrado", { status: 404 });

  const exam = getExam(row.exam_id);
  if (!exam) return new NextResponse("Prova não encontrada", { status: 404 });

  const version = requestedVersion === undefined ? undefined : getExamVersion(exam.id, requestedVersion);
  if (requestedVersion !== undefined && !version) {
    return new NextResponse("Versão não encontrada", { status: 404 });
  }

  const liveSet = exam.sets.find((candidate) => candidate.id === row.id);
  if (!liveSet) return new NextResponse("Set não encontrado", { status: 404 });
  const snapshotSet = version?.snapshot.sets.find((candidate) => candidate.sourceSetId === row.id);
  if (version && !snapshotSet) {
    return new NextResponse("Set não encontrado na versão", { status: 404 });
  }

  const questions: AnswerKeyImageQuestion[] = snapshotSet
    ? snapshotSet.questions.map((question) => ({
        position: question.position + 1,
        sourceQuestionId: question.sourceQuestionId,
        statementHtml: question.statementHtml,
        questionType: question.questionType,
        options: question.options,
        shuffledOptions: question.shuffledOptions,
        correctShuffledIndex: question.correctShuffledIndex,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      }))
    : [...liveSet.questions]
        .sort((a, b) => a.position - b.position || a.questionId - b.questionId)
        .flatMap((setQuestion) => {
          const question = getQuestion(setQuestion.questionId);
          if (!question) return [];
          return [{
            position: setQuestion.position + 1,
            sourceQuestionId: question.id,
            statementHtml: question.statement,
            questionType: question.questionType,
            options: question.options,
            shuffledOptions: setQuestion.shuffledOptions,
            correctShuffledIndex: setQuestion.correctShuffledIndex,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
          }];
        });

  const title = version?.snapshot.title ?? exam.title;
  const institution = version?.snapshot.institution ?? exam.institution;
  const label = snapshotSet?.label ?? liveSet.label;
  const png = await renderAnswerKeyPng({
    examTitle: title,
    institution,
    setLabel: label,
    versionNumber: version?.versionNumber,
    questions,
  });
  const filename = `gabarito-comentado-${safeFilename(title)}-set-${safeFilename(label)}.png`;

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(png.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
