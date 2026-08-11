import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getExam: vi.fn(),
  getExamVersion: vi.fn(),
  getQuestion: vi.fn(),
  renderAnswerKeyPng: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/db/exams", () => ({
  getExam: mocks.getExam,
  getExamVersion: mocks.getExamVersion,
}));
vi.mock("@/lib/db/questions", () => ({ getQuestion: mocks.getQuestion }));
vi.mock("@/lib/export/answer-key-image", () => ({
  renderAnswerKeyPng: mocks.renderAnswerKeyPng,
}));

import { GET } from "@/app/api/png/[setId]/route";

const EXAM = {
  id: 42,
  title: "Prova atual",
  institution: "UniFil",
  sets: [{ id: 9, label: "A", questions: [] }],
};

const SNAPSHOT_QUESTION = {
  position: 0,
  sourceQuestionId: 77,
  statementHtml: "Enunciado histórico",
  questionType: "verdadeiro_falso",
  options: [],
  shuffledOptions: [1, 0],
  correctShuffledIndex: 0,
  correctAnswer: "",
  explanation: "Justificativa histórica",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockReturnValue({
    prepare: () => ({ get: () => ({ id: 9, exam_id: 42 }) }),
  });
  mocks.getExam.mockReturnValue(EXAM);
  mocks.renderAnswerKeyPng.mockResolvedValue(Buffer.from([137, 80, 78, 71, 1, 2, 3]));
});

describe("commented answer-key PNG route", () => {
  it("renders the selected immutable version and downloads a PNG", async () => {
    mocks.getExamVersion.mockReturnValue({
      versionNumber: 4,
      snapshot: {
        title: "Prova histórica",
        institution: "Instituição histórica",
        sets: [{ sourceSetId: 9, label: "B", questions: [SNAPSHOT_QUESTION] }],
      },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/png/9?version=4"),
      { params: Promise.resolve({ setId: "9" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toContain("gabarito-comentado-prova-historica-set-b.png");
    expect(mocks.getExamVersion).toHaveBeenCalledWith(42, 4);
    expect(mocks.renderAnswerKeyPng).toHaveBeenCalledWith({
      examTitle: "Prova histórica",
      institution: "Instituição histórica",
      setLabel: "B",
      versionNumber: 4,
      questions: [{ ...SNAPSHOT_QUESTION, position: 1 }],
    });
  });

  it("rejects malformed and missing versions", async () => {
    const malformed = await GET(
      new NextRequest("http://localhost/api/png/9?version=antiga"),
      { params: Promise.resolve({ setId: "9" }) },
    );
    expect(malformed.status).toBe(400);

    mocks.getExamVersion.mockReturnValue(undefined);
    const missing = await GET(
      new NextRequest("http://localhost/api/png/9?version=99"),
      { params: Promise.resolve({ setId: "9" }) },
    );
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("Versão não encontrada");
  });
});
