import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCommentedAnswerKey: vi.fn(),
  renderHtmlPageToPdfBuffer: vi.fn(),
}));

vi.mock("@/lib/export/commented-answer-key", () => ({
  loadCommentedAnswerKey: mocks.loadCommentedAnswerKey,
  safeExportFilename: (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
}));
vi.mock("@/lib/print/browser-pdf", () => ({
  renderHtmlPageToPdfBuffer: mocks.renderHtmlPageToPdfBuffer,
}));

import { GET } from "@/app/api/pdf/commented/[setId]/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadCommentedAnswerKey.mockReturnValue({
    ok: true,
    data: {
      examId: 42,
      examTitle: "Prova histórica",
      institution: "UniFil",
      setId: 9,
      setLabel: "B",
      versionNumber: 4,
      questions: [],
    },
  });
  mocks.renderHtmlPageToPdfBuffer.mockResolvedValue(Buffer.from("%PDF-1.4 test"));
});

describe("commented answer-key PDF route", () => {
  it("forwards the version to the print page and downloads a PDF", async () => {
    const response = await GET(
      new Request("http://localhost/api/pdf/commented/9?version=4"),
      { params: Promise.resolve({ setId: "9" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("gabarito-comentado-prova-historica-set-b.pdf");
    expect(mocks.loadCommentedAnswerKey).toHaveBeenCalledWith(9, 4);
    expect(mocks.renderHtmlPageToPdfBuffer).toHaveBeenCalledWith(
      "http://localhost/print/commented-answer-key/9?version=4",
    );
  });

  it("rejects malformed and missing versions", async () => {
    const malformed = await GET(
      new Request("http://localhost/api/pdf/commented/9?version=antiga"),
      { params: Promise.resolve({ setId: "9" }) },
    );
    expect(malformed.status).toBe(400);

    mocks.loadCommentedAnswerKey.mockReturnValue({ ok: false, reason: "version" });
    const missing = await GET(
      new Request("http://localhost/api/pdf/commented/9?version=99"),
      { params: Promise.resolve({ setId: "9" }) },
    );
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("Versão não encontrada");
  });
});
