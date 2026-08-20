import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getExam: vi.fn(),
  getExamVersion: vi.fn(),
  getQuestion: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/db/exams", () => ({
  getExam: mocks.getExam,
  getExamVersion: mocks.getExamVersion,
}));
vi.mock("@/lib/db/questions", () => ({ getQuestion: mocks.getQuestion }));

import { loadCommentedAnswerKey, safeExportFilename } from "@/lib/export/commented-answer-key";

const EXAM = {
  id: 42,
  title: "Prova atual",
  institution: "UniFil",
  sets: [{
    id: 9,
    label: "A",
    questions: [{ questionId: 77, position: 0, shuffledOptions: [1, 0], correctShuffledIndex: 0 }],
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockReturnValue({
    prepare: () => ({ get: () => ({ id: 9, exam_id: 42 }) }),
  });
  mocks.getExam.mockReturnValue(EXAM);
});

describe("commented answer-key data", () => {
  it("loads the immutable selected version", () => {
    mocks.getExamVersion.mockReturnValue({
      versionNumber: 4,
      snapshot: {
        title: "Prova histórica",
        institution: "Instituição histórica",
        sets: [{
          sourceSetId: 9,
          label: "B",
          questions: [{
            position: 0,
            sourceQuestionId: 77,
            statementHtml: "Enunciado histórico",
            questionType: "verdadeiro_falso",
            options: [],
            shuffledOptions: [1, 0],
            correctShuffledIndex: 0,
            correctAnswer: "",
            explanation: "Justificativa histórica",
          }],
        }],
      },
    });

    expect(loadCommentedAnswerKey(9, 4)).toEqual({
      ok: true,
      data: {
        examId: 42,
        examTitle: "Prova histórica",
        institution: "Instituição histórica",
        setId: 9,
        setLabel: "B",
        versionNumber: 4,
        questions: [{
          position: 1,
          sourceQuestionId: 77,
          statementHtml: "Enunciado histórico",
          questionType: "verdadeiro_falso",
          options: [],
          shuffledOptions: [1, 0],
          correctShuffledIndex: 0,
          correctAnswer: "",
          explanation: "Justificativa histórica",
        }],
      },
    });
  });

  it("loads current question content and reports a missing version", () => {
    mocks.getQuestion.mockReturnValue({
      id: 77,
      statement: "Enunciado atual",
      questionType: "verdadeiro_falso",
      options: [],
      correctAnswer: "",
      explanation: "Justificativa atual",
    });

    const live = loadCommentedAnswerKey(9);
    expect(live.ok && live.data.questions[0]).toMatchObject({
      position: 1,
      sourceQuestionId: 77,
      statementHtml: "Enunciado atual",
      explanation: "Justificativa atual",
    });

    mocks.getExamVersion.mockReturnValue(undefined);
    expect(loadCommentedAnswerKey(9, 99)).toEqual({ ok: false, reason: "version" });
  });

  it("creates filesystem-safe names", () => {
    expect(safeExportFilename("Avaliação de POO - 2º Bimestre")).toBe("avaliacao-de-poo-2-bimestre");
  });
});
