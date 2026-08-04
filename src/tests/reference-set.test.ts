import { describe, expect, it } from "vitest";
import type { ExamSet } from "@/types";
import { getExamQuestionIdsInSetAOrder } from "@/lib/exam/reference-set";

function makeSet(label: string, ids: number[]): ExamSet {
  return {
    id: label.charCodeAt(0),
    examId: 1,
    label,
    evalBeeImageUrl: null,
    createdAt: "2026-08-04",
    questions: ids.map((questionId, position) => ({
      questionId,
      position,
      shuffledOptions: [],
      correctShuffledIndex: 0,
    })),
  };
}

describe("getExamQuestionIdsInSetAOrder", () => {
  it("uses Set A as the canonical export order regardless of database order", () => {
    const sets = [makeSet("C", [3, 1, 2]), makeSet("B", [2, 3, 1]), makeSet("A", [1, 2, 3])];

    expect(getExamQuestionIdsInSetAOrder(sets)).toEqual([1, 2, 3]);
  });

  it("respects positions and appends a question that exists only outside Set A", () => {
    const setA = makeSet("A", [10, 20]);
    setA.questions.reverse();
    const setB = makeSet("B", [20, 30, 10]);

    expect(getExamQuestionIdsInSetAOrder([setB, setA])).toEqual([10, 20, 30]);
  });

  it("falls back to the first label when an old exam has no Set A", () => {
    expect(getExamQuestionIdsInSetAOrder([makeSet("C", [2, 1]), makeSet("B", [1, 2])])).toEqual([1, 2]);
  });
});
