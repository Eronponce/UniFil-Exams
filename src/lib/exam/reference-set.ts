import type { ExamSet } from "@/types";

function compareSetsWithAFirst(a: ExamSet, b: ExamSet): number {
  const aIsReference = a.label.trim().toUpperCase() === "A";
  const bIsReference = b.label.trim().toUpperCase() === "A";
  if (aIsReference !== bIsReference) return aIsReference ? -1 : 1;
  return a.label.localeCompare(b.label, "pt-BR", { numeric: true });
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
