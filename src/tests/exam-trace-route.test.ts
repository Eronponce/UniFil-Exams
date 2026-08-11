import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getExam, getExamVersion, buildExamTraceCsv, buildExamTraceCsvFromSnapshot } = vi.hoisted(() => ({
  getExam: vi.fn(),
  getExamVersion: vi.fn(),
  buildExamTraceCsv: vi.fn(),
  buildExamTraceCsvFromSnapshot: vi.fn(),
}));

vi.mock("@/lib/db/exams", () => ({ getExam, getExamVersion }));
vi.mock("@/lib/pdf/exam-csv", () => ({ buildExamTraceCsv, buildExamTraceCsvFromSnapshot }));

import { GET } from "@/app/api/csv/exam/[examId]/trace/route";

const EXAM = { id: 42, title: "Prova Final", sets: [] };

beforeEach(() => {
  getExam.mockReset();
  getExamVersion.mockReset();
  buildExamTraceCsv.mockReset();
  buildExamTraceCsvFromSnapshot.mockReset();
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
    expect(getExamVersion).not.toHaveBeenCalled();
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

  it("uses the requested historical snapshot", async () => {
    const snapshot = { sourceExamId: 42, title: "Versão antiga", sets: [] };
    getExam.mockReturnValue(EXAM);
    getExamVersion.mockReturnValue({ snapshot });
    buildExamTraceCsvFromSnapshot.mockReturnValue('"historico"');

    const response = await GET(
      new NextRequest("http://localhost/api/csv/exam/42/trace?version=2"),
      { params: Promise.resolve({ examId: "42" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('"historico"');
    expect(getExamVersion).toHaveBeenCalledWith(42, 2);
    expect(buildExamTraceCsvFromSnapshot).toHaveBeenCalledWith(snapshot);
    expect(response.headers.get("content-disposition")).toContain("vers-o-antiga");
  });

  it("rejects malformed and missing versions clearly", async () => {
    getExam.mockReturnValue(EXAM);

    const invalid = await GET(
      new NextRequest("http://localhost/api/csv/exam/42/trace?version=abc"),
      { params: Promise.resolve({ examId: "42" }) },
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).toBe("Versão inválida");

    getExamVersion.mockReturnValue(undefined);
    const missing = await GET(
      new NextRequest("http://localhost/api/csv/exam/42/trace?version=99"),
      { params: Promise.resolve({ examId: "42" }) },
    );
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("Versão não encontrada");
  });
});
