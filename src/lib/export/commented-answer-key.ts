import { getDb } from "@/lib/db/client";
import { getExam, getExamVersion } from "@/lib/db/exams";
import { getQuestion } from "@/lib/db/questions";
import type { AnswerKeyImageQuestion } from "@/lib/export/answer-key-image";

interface SetRow {
  id: number;
  exam_id: number;
}

export interface CommentedAnswerKeyData {
  examId: number;
  examTitle: string;
  institution: string;
  setId: number;
  setLabel: string;
  versionNumber?: number;
  questions: AnswerKeyImageQuestion[];
}

export type CommentedAnswerKeyLoadResult =
  | { ok: true; data: CommentedAnswerKeyData }
  | { ok: false; reason: "set" | "exam" | "version" | "version-set" };

export function safeExportFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "prova";
}

export function loadCommentedAnswerKey(
  setId: number,
  versionNumber?: number,
): CommentedAnswerKeyLoadResult {
  const row = getDb()
    .prepare("SELECT id, exam_id FROM exam_sets WHERE id = ?")
    .get(setId) as SetRow | undefined;
  if (!row) return { ok: false, reason: "set" };

  const exam = getExam(row.exam_id);
  if (!exam) return { ok: false, reason: "exam" };

  const version = versionNumber === undefined
    ? undefined
    : getExamVersion(exam.id, versionNumber);
  if (versionNumber !== undefined && !version) {
    return { ok: false, reason: "version" };
  }

  const liveSet = exam.sets.find((candidate) => candidate.id === row.id);
  if (!liveSet) return { ok: false, reason: "set" };
  const snapshotSet = version?.snapshot.sets.find((candidate) => candidate.sourceSetId === row.id);
  if (version && !snapshotSet) {
    return { ok: false, reason: "version-set" };
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

  return {
    ok: true,
    data: {
      examId: exam.id,
      examTitle: version?.snapshot.title ?? exam.title,
      institution: version?.snapshot.institution ?? exam.institution,
      setId: row.id,
      setLabel: snapshotSet?.label ?? liveSet.label,
      versionNumber: version?.versionNumber,
      questions,
    },
  };
}
