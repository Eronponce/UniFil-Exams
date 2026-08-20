import fs from "fs";
import path from "path";
import type { Exam, ExamQuestionLayouts, ExamSet, QuestionLayout, QuestionOption, QuestionType } from "@/types";
import { getQuestion } from "@/lib/db/questions";
import { sanitizeRichText } from "@/lib/html/rich-text";
import { normalizeQuestionImageScalePercent } from "@/lib/print/question-image-scale";
import type { ExamVersion } from "@/lib/exam/version";

export interface PrintQuestionPayload {
  id: number;
  statementHtml: string;
  imageUrl: string | null;
  options: QuestionOption[];
  shuffledOptions: number[];
  questionType: QuestionType;
  answerLines: number;
  sourceQuestionId?: number;
  layoutOverride?: QuestionLayout | null;
  /** Resolved override first, then the persisted per-type layout. */
  layout?: QuestionLayout;
  /** Persisted visual-draft scale, normalized to 100 when absent. */
  imageScalePercent?: number;
}

export interface PrintSetPayload {
  id: number;
  label: string;
  questions: PrintQuestionPayload[];
}

export interface PrintExamPayload {
  examId: number;
  title: string;
  institution: string;
  instructions: string;
  answerKeyWidthPt: number;
  allowQuestionSplit: boolean;
  questionLayouts: ExamQuestionLayouts;
  logoUrl: string | null;
  answerKeyUrl: string | null;
  sets: PrintSetPayload[];
  versionNumber?: number;
}

function existingPublicAsset(fileNames: string[]): string | null {
  for (const fileName of fileNames) {
    if (fs.existsSync(path.join(process.cwd(), "public", fileName))) {
      return `/${fileName.replace(/\\/g, "/")}`;
    }
  }
  return null;
}

function getLogoUrl(): string | null {
  return existingPublicAsset(["unifil-logo.jpg", "unifil-logo.jpeg", "unifil-logo.png"])
    ? "/api/upload/logo/file"
    : null;
}

function getAnswerKeyUrl(examId: number): string | null {
  return existingPublicAsset([
    `gabaritos/${examId}.png`,
    `gabaritos/${examId}.jpg`,
    `gabaritos/${examId}.jpeg`,
  ])
    ? `/api/upload/gabarito/${examId}/file`
    : null;
}

function buildPrintSet(set: ExamSet, exam: Exam): PrintSetPayload {
  const questions = [...set.questions]
    .sort((a, b) => a.position - b.position)
    .map((sq) => {
      const question = getQuestion(sq.questionId);
      if (!question) return null;
      return {
        id: question.id,
        sourceQuestionId: question.id,
        statementHtml: sanitizeRichText(question.statement),
        imageUrl: question.imageUrl,
        options: question.options,
        shuffledOptions: sq.shuffledOptions,
        questionType: question.questionType,
        answerLines: question.answerLines,
        imageScalePercent: normalizeQuestionImageScalePercent(exam.questionImageScaleOverrides?.[question.id]),
        layoutOverride: exam.questionLayoutOverrides[question.id] ?? null,
        layout: exam.questionLayoutOverrides[question.id] ?? exam.questionLayouts[question.questionType],
      };
    })
    .filter(Boolean) as PrintQuestionPayload[];

  return {
    id: set.id,
    label: set.label,
    questions,
  };
}

function buildPrintSetFromSnapshot(set: ExamVersion["snapshot"]["sets"][number]): PrintSetPayload {
  return {
    id: set.sourceSetId,
    label: set.label,
    questions: [...set.questions]
      .sort((a, b) => a.position - b.position)
      .map((question) => ({
        id: question.sourceQuestionId,
        sourceQuestionId: question.sourceQuestionId,
        statementHtml: sanitizeRichText(question.statementHtml),
        imageUrl: question.imageUrl,
        options: question.options.map((option) => ({ ...option })),
        shuffledOptions: [...question.shuffledOptions],
        questionType: question.questionType,
        answerLines: question.answerLines,
        imageScalePercent: normalizeQuestionImageScalePercent(question.imageScalePercent),
        layoutOverride: question.layoutOverride,
        layout: question.layout,
      })),
  };
}

export function buildPrintExamPayload(exam: Exam, version?: ExamVersion | null): PrintExamPayload {
  const snapshot = version?.snapshot;
  const sets = [...exam.sets]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((set) => buildPrintSet(set, exam));
  const snapshotSets = snapshot
    ? [...snapshot.sets].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true })).map(buildPrintSetFromSnapshot)
    : sets;

  return {
    examId: exam.id,
    title: snapshot?.title ?? exam.title,
    institution: snapshot?.institution ?? exam.institution,
    instructions: snapshot?.instructions ?? exam.instructions,
    answerKeyWidthPt: snapshot?.answerKeyWidthPt ?? exam.answerKeyWidthPt,
    allowQuestionSplit: snapshot?.allowQuestionSplit ?? exam.allowQuestionSplit,
    questionLayouts: snapshot?.questionLayouts ?? exam.questionLayouts,
    logoUrl: getLogoUrl(),
    answerKeyUrl: getAnswerKeyUrl(exam.id),
    sets: snapshotSets,
    versionNumber: version?.versionNumber,
  };
}
