import type { ExamSet, ExamSetQuestion, Question } from "@/types";

function compareSetsWithAFirst(a: ExamSet, b: ExamSet): number {
  const aIsReference = a.label.trim().toUpperCase() === "A";
  const bIsReference = b.label.trim().toUpperCase() === "A";
  if (aIsReference !== bIsReference) return aIsReference ? -1 : 1;
  return a.label.localeCompare(b.label, "pt-BR", { numeric: true });
}

export function getExamReferenceSet(sets: ExamSet[]): ExamSet | undefined {
  return [...sets].sort(compareSetsWithAFirst)[0];
}

/**
 * Returns every exam question once, using Set A as the canonical sequence.
 * Questions found only in another set are appended defensively.
 */
export function getExamQuestionIdsInSetAOrder(sets: ExamSet[]): number[] {
  const seen = new Set<number>();
  const questionIds: number[] = [];

  for (const set of [...sets].sort(compareSetsWithAFirst)) {
    for (const question of [...set.questions].sort((a, b) => a.position - b.position)) {
      if (seen.has(question.questionId)) continue;
      seen.add(question.questionId);
      questionIds.push(question.questionId);
    }
  }

  return questionIds;
}

export interface SetOptionDisplay {
  originalIndex: number;
  letter: string;
  text: string;
  isCorrect: boolean;
}

/** Reproduces the option sequence and answer letter printed in a specific set. */
export function getQuestionOptionsInSetOrder(
  question: Question,
  setQuestion: ExamSetQuestion | undefined,
): SetOptionDisplay[] {
  const optionsByIndex = new Map(question.options.map((option) => [option.index, option]));
  const shuffledIndices = setQuestion?.shuffledOptions ?? [];
  const hasValidSetOrder = shuffledIndices.length === question.options.length
    && new Set(shuffledIndices).size === question.options.length
    && shuffledIndices.every((index) => optionsByIndex.has(index));
  const indices = hasValidSetOrder ? shuffledIndices : question.options.map((option) => option.index);

  return indices.map((originalIndex, position) => ({
    originalIndex,
    letter: String.fromCharCode(65 + position),
    text: optionsByIndex.get(originalIndex)?.text ?? "",
    isCorrect: originalIndex === question.correctIndex,
  }));
}
