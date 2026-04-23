import { describe, it, expect, vi } from "vitest";
import type { ExamSet } from "@/types";

vi.mock("@/lib/db/questions", () => ({
  getQuestion: (id: number) => ({
    id,
    disciplineId: 1,
    statement: `Questão ${id}?`,
    imageUrl: null,
    options: [
      { index: 0, text: "A" },
      { index: 1, text: "B" },
      { index: 2, text: "C" },
      { index: 3, text: "D" },
      { index: 4, text: "E" },
    ],
    correctIndex: 0,
    difficulty: "medium" as const,
    source: "manual" as const,
    audited: true,
    createdAt: "2026-04-22",
  }),
}));

describe("buildAnswerKeyCsv", () => {
  it("generates CSV with correct answer letters", async () => {
    const { buildAnswerKeyCsv } = await import("@/lib/pdf/exam-csv");

    const set: ExamSet = {
      id: 1,
      examId: 1,
      label: "A",
      evalBeeImageUrl: null,
      createdAt: "2026-04-22",
      questions: [
        { questionId: 10, position: 0, shuffledOptions: [1, 0, 2, 3, 4], correctShuffledIndex: 1 },
        { questionId: 11, position: 1, shuffledOptions: [2, 1, 0, 3, 4], correctShuffledIndex: 0 },
      ],
    };

    const csv = buildAnswerKeyCsv("Prova 1", set);
    expect(csv).toContain("Set A");
    expect(csv).toContain("1,B");
    expect(csv).toContain("2,A");
  });
});
