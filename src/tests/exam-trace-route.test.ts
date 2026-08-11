import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getExam, buildExamTraceCsv } = vi.hoisted(() => ({
  getExam: vi.fn(),
  buildExamTraceCsv: vi.fn(),
}));

vi.mock("@/lib/db/exams", () => ({ getExam }));
vi.mock("@/lib/pdf/exam-csv", () => ({ buildExamTraceCsv }));

import { GET } from "@/app/api/csv/exam/[examId]/trace/route";

const EXAM = { id: 42, title: "Prova Final", sets: [] };

beforeEach(() => {
  getExam.mockReset();
  buildExamTraceCsv.mockReset();
});

describe("exam trace CSV route", () => {
  it("returns a UTF-8 download with a predictable filename", async () => {
    getExam.mockReturnValue(EXAM);
    buildExamTraceCsv.mockReturnValue('"chave_rastreabilidade"\r\n"42:A:1"');

    const response = await GET(
      new NextRequest("http://localhost/api/csv/exam/42/trace"),
      { params: Promise.resolve({ examId: "42" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('"chave_rastreabilidade"\r\n"42:A:1"');
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="mapa-rastreabilidade-prova-final.csv"');
    expect(getExam).toHaveBeenCalledWith(42);
    expect(buildExamTraceCsv).toHaveBeenCalledWith(EXAM);
  });

  it("returns 404 when the exam does not exist", async () => {
    getExam.mockReturnValue(undefined);

    const response = await GET(
      new NextRequest("http://localhost/api/csv/exam/999/trace"),
      { params: Promise.resolve({ examId: "999" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Prova não encontrada");
    expect(buildExamTraceCsv).not.toHaveBeenCalled();
  });
});
