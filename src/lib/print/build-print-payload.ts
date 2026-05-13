import fs from "fs";
import path from "path";
import type { Exam, ExamSet, QuestionOption, QuestionType } from "@/types";
import { getQuestion } from "@/lib/db/questions";
import { sanitizeRichText } from "@/lib/html/rich-text";

export interface PrintQuestionPayload {
  id: number;
  statementHtml: string;
  imageUrl: string | null;
  options: QuestionOption[];
  shuffledOptions: number[];
  questionType: QuestionType;
  answerLines: number;
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
  answerKeyWidthPt: number;
  logoUrl: string | null;
  answerKeyUrl: string | null;
  sets: PrintSetPayload[];
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

function buildPrintSet(set: ExamSet): PrintSetPayload {
  const questions = [...set.questions]
    .sort((a, b) => a.position - b.position)
    .map((sq) => {
      const question = getQuestion(sq.questionId);
      if (!question) return null;
      return {
        id: question.id,
        statementHtml: sanitizeRichText(question.statement),
        imageUrl: question.imageUrl,
        options: question.options,
        shuffledOptions: sq.shuffledOptions,
        questionType: question.questionType,
        answerLines: question.answerLines,
      };
    })
    .filter(Boolean) as PrintQuestionPayload[];

  return {
    id: set.id,
    label: set.label,
    questions,
  };
}

export function buildPrintExamPayload(exam: Exam): PrintExamPayload {
  const sets = [...exam.sets]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(buildPrintSet);

  return {
    examId: exam.id,
    title: exam.title,
    institution: exam.institution,
    answerKeyWidthPt: exam.answerKeyWidthPt,
    logoUrl: getLogoUrl(),
    answerKeyUrl: getAnswerKeyUrl(exam.id),
    sets,
  };
}
