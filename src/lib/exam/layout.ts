import type { ExamQuestionLayouts, QuestionLayout, QuestionType } from "@/types";

export const DEFAULT_EXAM_QUESTION_LAYOUTS: ExamQuestionLayouts = {
  objetiva: "column",
  verdadeiro_falso: "column",
  numerica: "column",
  dissertativa: "full",
};

export function normalizeQuestionLayout(value: unknown, fallback: QuestionLayout): QuestionLayout {
  return value === "column" || value === "full" ? value : fallback;
}

export function normalizeExamQuestionLayouts(
  layouts?: Partial<Record<QuestionType, unknown>> | null,
): ExamQuestionLayouts {
  return {
    objetiva: normalizeQuestionLayout(layouts?.objetiva, DEFAULT_EXAM_QUESTION_LAYOUTS.objetiva),
    verdadeiro_falso: normalizeQuestionLayout(layouts?.verdadeiro_falso, DEFAULT_EXAM_QUESTION_LAYOUTS.verdadeiro_falso),
    numerica: normalizeQuestionLayout(layouts?.numerica, DEFAULT_EXAM_QUESTION_LAYOUTS.numerica),
    dissertativa: normalizeQuestionLayout(layouts?.dissertativa, DEFAULT_EXAM_QUESTION_LAYOUTS.dissertativa),
  };
}
