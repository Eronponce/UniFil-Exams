import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCommentedAnswerKey: vi.fn(),
  renderAnswerKeyPng: vi.fn(),
}));

vi.mock("@/lib/export/answer-key-image", () => ({
  renderAnswerKeyPng: mocks.renderAnswerKeyPng,
}));
vi.mock("@/lib/export/commented-answer-key", () => ({
  loadCommentedAnswerKey: mocks.loadCommentedAnswerKey,
  safeExportFilename: (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
}));

import { GET } from "@/app/api/png/[setId]/route";

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
  mocks.renderAnswerKeyPng.mockResolvedValue(Buffer.from([137, 80, 78, 71, 1, 2, 3]));
});

describe("commented answer-key PNG route", () => {
  it("renders the selected immutable version and downloads a PNG", async () => {
    mocks.loadCommentedAnswerKey.mockReturnValue({
      ok: true,
      data: {
        examId: 42,
        examTitle: "Prova histórica",
        institution: "Instituição histórica",
        setId: 9,
        setLabel: "B",
        versionNumber: 4,
        questions: [{ ...SNAPSHOT_QUESTION, position: 1 }],
      },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/png/9?version=4"),
      { params: Promise.resolve({ setId: "9" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toContain("gabarito-comentado-prova-historica-set-b.png");
    expect(mocks.loadCommentedAnswerKey).toHaveBeenCalledWith(9, 4);
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

    mocks.loadCommentedAnswerKey.mockReturnValue({ ok: false, reason: "version" });
    const missing = await GET(
      new NextRequest("http://localhost/api/png/9?version=99"),
      { params: Promise.resolve({ setId: "9" }) },
    );
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("Versão não encontrada");
  });
});
