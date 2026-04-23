import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExamSet, Question } from "@/types";

const mockGetQuestion = vi.fn<[number], Question | undefined>();

vi.mock("@/lib/db/questions", () => ({
  getQuestion: (id: number) => mockGetQuestion(id),
}));

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 10,
    disciplineId: 1,
    statement: "Questão 10?",
    imageUrl: null,
    options: [
      { index: 0, text: "A" },
      { index: 1, text: "B" },
      { index: 2, text: "C" },
      { index: 3, text: "D" },
      { index: 4, text: "E" },
    ],
    correctIndex: 0,
    difficulty: "medium",
    source: "manual",
    audited: true,
    thematicArea: null,
    explanation: "",
    questionType: "objetiva",
    answerLines: 0,
    createdAt: "2026-04-22",
    ...overrides,
  };
}

beforeEach(() => { mockGetQuestion.mockReset(); });

describe("buildAnswerKeyCsv — objetivas", () => {
  it("generates CSV with correct answer letters", async () => {
    const { buildAnswerKeyCsv } = await import("@/lib/pdf/exam-csv");

    mockGetQuestion.mockImplementation((id) => makeQuestion({ id, statement: `Questão ${id}?` }));

    const set: ExamSet = {
      id: 1, examId: 1, label: "A", evalBeeImageUrl: null, createdAt: "2026-04-22",
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

describe("buildAnswerKeyCsv — V/F and dissertativa", () => {
  it("V/F question outputs V when shuffledOptions[correctShuffledIndex]=0", async () => {
    const { buildAnswerKeyCsv } = await import("@/lib/pdf/exam-csv");
    mockGetQuestion.mockReturnValue(makeQuestion({ questionType: "verdadeiro_falso", options: [{ index: 0, text: "Verdadeiro" }, { index: 1, text: "Falso" }], correctIndex: 0 }));

    const set: ExamSet = {
      id: 2, examId: 1, label: "B", evalBeeImageUrl: null, createdAt: "2026-04-22",
      questions: [
        { questionId: 99, position: 0, shuffledOptions: [0, 1], correctShuffledIndex: 0 },
        { questionId: 99, position: 1, shuffledOptions: [1, 0], correctShuffledIndex: 0 },
      ],
    };

    const csv = buildAnswerKeyCsv("Prova VF", set);
    expect(csv).toContain("1,V");
    expect(csv).toContain("2,F");
  });

  it("dissertativa outputs 'Dissertativa'", async () => {
    const { buildAnswerKeyCsv } = await import("@/lib/pdf/exam-csv");
    mockGetQuestion.mockReturnValue(makeQuestion({ questionType: "dissertativa", options: [], answerLines: 5 }));

    const set: ExamSet = {
      id: 3, examId: 1, label: "C", evalBeeImageUrl: null, createdAt: "2026-04-22",
      questions: [{ questionId: 100, position: 0, shuffledOptions: [], correctShuffledIndex: 0 }],
    };

    const csv = buildAnswerKeyCsv("Prova Diss", set);
    expect(csv).toContain("1,Dissertativa");
  });
});
