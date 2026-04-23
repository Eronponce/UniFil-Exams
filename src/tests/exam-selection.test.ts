import { describe, expect, it } from "vitest";
import { normalizeExamSelectionRequest, pickQuestionsForExam } from "@/lib/exam/select-questions";
import type { QuestionInfo } from "@/lib/exam/randomize";

const QUESTIONS: QuestionInfo[] = [
  { id: 1, correctIndex: 0, questionType: "objetiva" },
  { id: 2, correctIndex: 1, questionType: "objetiva" },
  { id: 3, correctIndex: 0, questionType: "verdadeiro_falso" },
  { id: 4, correctIndex: 1, questionType: "verdadeiro_falso" },
  { id: 5, correctIndex: 0, questionType: "dissertativa" },
];

describe("normalizeExamSelectionRequest", () => {
  it("reads total and per-type quantities from form data", () => {
    const formData = new FormData();
    formData.set("numQuestions", "4");
    formData.set("numObjetivas", "2");
    formData.set("numVF", "1");
    formData.set("numDissertativas", "1");

    expect(normalizeExamSelectionRequest(formData)).toEqual({
      totalRequested: 4,
      requestedByType: {
        objetiva: 2,
        verdadeiro_falso: 1,
        dissertativa: 1,
      },
    });
  });
});

describe("pickQuestionsForExam", () => {
  it("returns all questions when no filter is requested", () => {
    const picked = pickQuestionsForExam(QUESTIONS, {
      totalRequested: 0,
      requestedByType: { objetiva: 0, verdadeiro_falso: 0, dissertativa: 0 },
    });

    expect(picked).toHaveLength(5);
  });

  it("samples the requested total when only numQuestions is provided", () => {
    const picked = pickQuestionsForExam(QUESTIONS, {
      totalRequested: 3,
      requestedByType: { objetiva: 0, verdadeiro_falso: 0, dissertativa: 0 },
    });

    expect(picked).toHaveLength(3);
  });

  it("picks exact counts by type when provided", () => {
    const picked = pickQuestionsForExam(QUESTIONS, {
      totalRequested: 0,
      requestedByType: { objetiva: 2, verdadeiro_falso: 1, dissertativa: 1 },
    });

    expect(picked.filter((q) => q.questionType === "objetiva")).toHaveLength(2);
    expect(picked.filter((q) => q.questionType === "verdadeiro_falso")).toHaveLength(1);
    expect(picked.filter((q) => q.questionType === "dissertativa")).toHaveLength(1);
  });

  it("throws when requested count exceeds available pool of a type", () => {
    expect(() =>
      pickQuestionsForExam(QUESTIONS, {
        totalRequested: 0,
        requestedByType: { objetiva: 3, verdadeiro_falso: 0, dissertativa: 0 },
      }),
    ).toThrow(/Solicitadas 3 questão\(ões\) do tipo objetiva/);
  });
});
