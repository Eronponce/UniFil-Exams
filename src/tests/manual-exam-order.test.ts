import { describe, expect, it } from "vitest";
import {
  CANONICAL_QUESTION_GROUPS,
  normalizeManualQuestionOrder,
} from "@/lib/exam/manual-order";

describe("normalizeManualQuestionOrder", () => {
  it("uses canonical type/layout groups, preserves in-group requests, and appends omitted IDs deterministically", () => {
    const questions = [
      { id: 9, questionType: "dissertativa" as const, layout: "column" as const },
      { id: 3, questionType: "objetiva" as const, layout: "full" as const },
      { id: 1, questionType: "objetiva" as const, layout: "column" as const },
      { id: 8, questionType: "dissertativa" as const, layout: "full" as const },
      { id: 5, questionType: "verdadeiro_falso" as const, layout: "column" as const },
      { id: 7, questionType: "numerica" as const, layout: "column" as const },
      { id: 2, questionType: "objetiva" as const, layout: "column" as const },
      { id: 6, questionType: "numerica" as const, layout: "full" as const },
      { id: 4, questionType: "verdadeiro_falso" as const, layout: "full" as const },
    ];

    const normalized = normalizeManualQuestionOrder(questions, [2, 1, 3, 5, 4, 6, 6, 999]);

    expect(normalized.map((question) => question.id)).toEqual([2, 1, 3, 5, 4, 7, 6, 9, 8]);
    expect(new Set(normalized.map((question) => question.id)).size).toBe(questions.length);
  });

  it("exposes the frozen canonical groups for client consumers", () => {
    expect(CANONICAL_QUESTION_GROUPS.map(({ questionType, layout }) => `${questionType}:${layout}`)).toEqual([
      "objetiva:column",
      "objetiva:full",
      "verdadeiro_falso:column",
      "verdadeiro_falso:full",
      "numerica:column",
      "numerica:full",
      "dissertativa:column",
      "dissertativa:full",
    ]);
  });
});
