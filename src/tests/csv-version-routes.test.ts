import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExam: vi.fn(),
  getExamVersion: vi.fn(),
  getDb: vi.fn(),
  buildAnswerKeyMatrixCsv: vi.fn(),
  buildAnswerKeyMatrixCsvFromSnapshot: vi.fn(),
  buildAnswerKeyCsv: vi.fn(),
  buildAnswerKeyCsvFromSnapshot: vi.fn(),
  buildExamTraceCsv: vi.fn(),
  buildExamTraceCsvFromSnapshot: vi.fn(),
}));

vi.mock("@/lib/db/exams", () => ({ getExam: mocks.getExam, getExamVersion: mocks.getExamVersion }));
vi.mock("@/lib/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/pdf/exam-csv", () => ({
  buildAnswerKeyMatrixCsv: mocks.buildAnswerKeyMatrixCsv,
  buildAnswerKeyMatrixCsvFromSnapshot: mocks.buildAnswerKeyMatrixCsvFromSnapshot,
  buildAnswerKeyCsv: mocks.buildAnswerKeyCsv,
  buildAnswerKeyCsvFromSnapshot: mocks.buildAnswerKeyCsvFromSnapshot,
  buildExamTraceCsv: mocks.buildExamTraceCsv,
  buildExamTraceCsvFromSnapshot: mocks.buildExamTraceCsvFromSnapshot,
}));

import { GET as getCombinedCsv } from "@/app/api/csv/exam/[examId]/route";
import { GET as getSetCsv } from "@/app/api/csv/[setId]/route";

const SNAPSHOT = {
  sourceExamId: 42,
  title: "Prova histórica",
  sets: [{ sourceSetId: 9, label: "A", questions: [] }],
};
const EXAM = {
  id: 42,
  title: "Prova atual",
  sets: [{ id: 9, label: "A", questions: [] }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getExam.mockReturnValue(EXAM);
  mocks.getDb.mockReturnValue({
    prepare: () => ({ get: () => ({ id: 9, exam_id: 42 }) }),
  });
});

describe("versioned answer-key CSV routes", () => {
  it("builds the combined CSV from the selected snapshot", async () => {
    mocks.getExamVersion.mockReturnValue({ snapshot: SNAPSHOT });
    mocks.buildAnswerKeyMatrixCsvFromSnapshot.mockReturnValue('"historico"');

    const response = await getCombinedCsv(
      new NextRequest("http://localhost/api/csv/exam/42?version=3"),
      { params: Promise.resolve({ examId: "42" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('"historico"');
    expect(mocks.getExamVersion).toHaveBeenCalledWith(42, 3);
    expect(mocks.buildAnswerKeyMatrixCsvFromSnapshot).toHaveBeenCalledWith(SNAPSHOT);
    expect(mocks.buildAnswerKeyMatrixCsv).not.toHaveBeenCalled();
    expect(response.headers.get("content-disposition")).toContain("prova-hist-rica");
  });

  it("builds a per-set CSV from the selected snapshot", async () => {
    mocks.getExamVersion.mockReturnValue({ snapshot: SNAPSHOT });
    mocks.buildAnswerKeyCsvFromSnapshot.mockReturnValue('"historico-set"');

    const response = await getSetCsv(
      new NextRequest("http://localhost/api/csv/9?version=3"),
      { params: Promise.resolve({ setId: "9" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('"historico-set"');
    expect(mocks.buildAnswerKeyCsvFromSnapshot).toHaveBeenCalledWith("Prova histórica", SNAPSHOT.sets[0]);
    expect(mocks.buildAnswerKeyCsv).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed combined version and 404 for missing set version", async () => {
    const invalid = await getCombinedCsv(
      new NextRequest("http://localhost/api/csv/exam/42?version=zero"),
      { params: Promise.resolve({ examId: "42" }) },
    );
    expect(invalid.status).toBe(400);

    mocks.getExamVersion.mockReturnValue(undefined);
    const missing = await getSetCsv(
      new NextRequest("http://localhost/api/csv/9?version=99"),
      { params: Promise.resolve({ setId: "9" }) },
    );
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("Versão não encontrada");
  });
});
