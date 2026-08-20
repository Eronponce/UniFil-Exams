import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExam: vi.fn(),
  getExamVersion: vi.fn(),
  getDb: vi.fn(),
  renderHtmlPageToPdfBuffer: vi.fn(),
}));

vi.mock("@/lib/db/exams", () => ({
  getExam: mocks.getExam,
  getExamVersion: mocks.getExamVersion,
}));
vi.mock("@/lib/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/print/browser-pdf", () => ({
  renderHtmlPageToPdfBuffer: mocks.renderHtmlPageToPdfBuffer,
}));

import { GET as getExamPdf } from "@/app/api/pdf/exam/[examId]/route";
import { GET as getSetPdf } from "@/app/api/pdf/[setId]/route";

const EXAM = {
  id: 42,
  title: "Prova atual",
  sets: [{ id: 9, label: "A", questions: [] }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getExam.mockReturnValue(EXAM);
  mocks.getExamVersion.mockReturnValue({ snapshot: { title: "Prova histórica" } });
  mocks.getDb.mockReturnValue({
    prepare: () => ({ get: () => ({ id: 9, exam_id: 42, label: "A" }) }),
  });
  mocks.renderHtmlPageToPdfBuffer.mockResolvedValue(Buffer.from("pdf"));
});

function forwardedUrl(): URL {
  return new URL(mocks.renderHtmlPageToPdfBuffer.mock.calls[0]?.[0] as string);
}

describe("PDF image-scale query forwarding", () => {
  it("keeps a 100% tombstone and historical version on the exam print URL", async () => {
    const response = await getExamPdf(
      new NextRequest("http://localhost/api/pdf/exam/42?version=3&imageScale=7%3A100%2Cbad%2C0%3A75%2C9%3A24%2C12%3A75"),
      { params: Promise.resolve({ examId: "42" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.getExamVersion).toHaveBeenCalledWith(42, 3);
    expect(forwardedUrl().pathname).toBe("/print/exam/42");
    expect(forwardedUrl().searchParams.get("version")).toBe("3");
    expect(forwardedUrl().searchParams.get("imageScale")).toBe("7:100,12:75");
  });

  it("keeps a 100% tombstone on the set print URL while rejecting malformed entries", async () => {
    const response = await getSetPdf(
      new NextRequest("http://localhost/api/pdf/9?imageScale=7%3A100%2C7%3Abad%2C8%3A101%2C9%3A50"),
      { params: Promise.resolve({ setId: "9" }) },
    );

    expect(response.status).toBe(200);
    expect(forwardedUrl().pathname).toBe("/print/set/9");
    expect(forwardedUrl().searchParams.get("imageScale")).toBe("7:100,9:50");
  });
});
