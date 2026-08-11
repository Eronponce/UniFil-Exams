import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/client", () => ({ getDb: () => db }));

import { createExam, createExamSet, createExamVersion, getExam, getExamVersion, listExamVersions, restoreExamVersion, saveExamVersion } from "@/lib/db/exams";
import { createQuestion, updateQuestion } from "@/lib/db/questions";
import { migrate } from "@/lib/db/schema";
import { DEFAULT_EXAM_INSTRUCTIONS } from "@/lib/exam/instructions";
import { buildPrintExamPayload } from "@/lib/print/build-print-payload";

function addQuestion(statement = "<p>Enunciado original</p>") {
  return createQuestion({
    disciplineId: 1,
    statement,
    options: ["A original", "B original", "C original", "D original", "E original"],
    correctIndex: 0,
    imagePath: "/uploads/questions/original.png",
    questionType: "objetiva",
  });
}

function addExam() {
  const question = addQuestion();
  const exam = createExam({ disciplineId: 1, title: "Prova original", questionIds: [question.id] });
  createExamSet(exam.id, {
    label: "A",
    questionOrder: [question.id],
    shuffledOptions: [[1, 0, 2, 3, 4]],
    correctShuffledIndices: [1],
  });
  createExamVersion(exam.id, "Criação");
  return { exam, question };
}

beforeEach(() => {
  db = new Database(":memory:");
  migrate();
  db.prepare("INSERT INTO disciplines (id, name, code) VALUES (1, 'História', 'HIS')").run();
});

afterEach(() => db.close());

describe("exam versions", () => {
  it("creates version 1 after sets exist and loads the stable defaults", () => {
    const { exam } = addExam();
    const loaded = getExam(exam.id)!;
    const version = getExamVersion(exam.id, 1)!;

    expect(loaded.active).toBe(true);
    expect(loaded.instructions).toBe(DEFAULT_EXAM_INSTRUCTIONS);
    expect(version.versionNumber).toBe(1);
    expect(version.snapshot.sets[0]?.questions[0]?.sourceQuestionId).toBeGreaterThan(0);
    expect(version.snapshot.sets[0]?.questions[0]?.sourceSetId).toBeGreaterThan(0);
  });

  it("keeps the old printable payload immutable after a bank edit", () => {
    const { exam, question } = addExam();
    const version = getExamVersion(exam.id, 1)!;
    updateQuestion(question.id, {
      statement: "<p>Enunciado alterado depois</p>",
      options: ["A alterada", "B alterada", "C alterada", "D alterada", "E alterada"],
      imagePath: "/uploads/questions/alterada.png",
    });

    const historical = buildPrintExamPayload(getExam(exam.id)!, version);
    expect(historical.title).toBe("Prova original");
    expect(historical.sets[0]?.questions[0]?.statementHtml).toContain("Enunciado original");
    expect(historical.sets[0]?.questions[0]?.options[0]?.text).toBe("A original");
    expect(historical.sets[0]?.questions[0]?.imageUrl).toBe("/uploads/questions/original.png");

    const live = buildPrintExamPayload(getExam(exam.id)!);
    expect(live.sets[0]?.questions[0]?.statementHtml).toContain("Enunciado alterado depois");
  });

  it("appends edits, resolves question overrides first, and restores as another version", () => {
    const { exam, question } = addExam();
    const saved = saveExamVersion(exam.id, {
      title: "Prova revisada",
      institution: "UniFil",
      instructions: "Instruções revisadas",
      allowQuestionSplit: true,
      questionLayouts: { objetiva: "column" },
      questionLayoutOverrides: { [question.id]: "full" },
      changeNote: "Q1 em largura total",
    });

    expect(saved.versionNumber).toBe(2);
    expect(listExamVersions(exam.id).map((version) => version.versionNumber)).toEqual([2, 1]);
    expect(saved.snapshot.title).toBe("Prova revisada");
    expect(saved.snapshot.instructions).toBe("Instruções revisadas");
    expect(saved.snapshot.sets[0]?.questions[0]?.layout).toBe("full");
    expect(saved.snapshot.sets[0]?.questions[0]?.shuffledOptions).toEqual([1, 0, 2, 3, 4]);
    expect(buildPrintExamPayload(getExam(exam.id)!).sets[0]?.questions[0]?.layout).toBe("full");
    expect(getExam(exam.id)?.questionLayoutOverrides).toEqual({ [question.id]: "full" });
    expect(getExamVersion(exam.id, 1)?.snapshot.title).toBe("Prova original");

    const restored = restoreExamVersion(exam.id, 1);
    expect(restored.versionNumber).toBe(3);
    expect(restored.changeNote).toContain("Restaurada da versão 1");
    expect(restored.snapshot.title).toBe("Prova original");
    expect(getExam(exam.id)?.title).toBe("Prova original");
    expect(getExam(exam.id)?.questionLayoutOverrides).toEqual({});
    expect(listExamVersions(exam.id).map((version) => version.versionNumber)).toEqual([3, 2, 1]);
  });
});
