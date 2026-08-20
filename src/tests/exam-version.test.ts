import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/client", () => ({ getDb: () => db }));

import { createExam, createExamSet, createExamVersion, getExam, getExamVersion, listExamVersions, restoreExamVersion, saveExamVersion } from "@/lib/db/exams";
import { createQuestion, updateQuestion } from "@/lib/db/questions";
import { migrate } from "@/lib/db/schema";
import { DEFAULT_EXAM_INSTRUCTIONS } from "@/lib/exam/instructions";
import { parseExamVersionSnapshot } from "@/lib/exam/version";
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

  it("persists only selected initial width overrides into exam_questions and version 1", () => {
    const selected = addQuestion("<p>Selecionada</p>");
    const notSelected = addQuestion("<p>Fora da prova</p>");
    const exam = createExam({
      disciplineId: 1,
      title: "Com largura inicial",
      questionIds: [selected.id],
      questionLayoutOverrides: {
        [selected.id]: "full",
        [notSelected.id]: "full",
        999999: "full",
      },
    });
    createExamSet(exam.id, {
      label: "A",
      questionOrder: [selected.id],
      shuffledOptions: [[0, 1, 2, 3, 4]],
      correctShuffledIndices: [0],
    });
    const version = createExamVersion(exam.id);

    expect(getExam(exam.id)?.questionLayoutOverrides).toEqual({ [selected.id]: "full" });
    expect(version.snapshot.sets[0]?.questions[0]?.layout).toBe("full");
    expect(buildPrintExamPayload(getExam(exam.id)!).sets[0]?.questions[0]?.layout).toBe("full");
    expect(db.prepare("SELECT layout_override FROM exam_questions WHERE exam_id = ? AND question_id = ?").get(exam.id, selected.id)).toEqual({ layout_override: "full" });
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

  it("preserves image scales in live models, immutable snapshots, print payloads, saves, and restores", () => {
    const selected = addQuestion("<p>Imagem</p>");
    const other = addQuestion("<p>Outra</p>");
    const exam = createExam({
      disciplineId: 1,
      title: "Escalas",
      questionIds: [selected.id, other.id],
      questionImageScaleOverrides: {
        [selected.id]: 75,
        [other.id]: 100,
        99999: 50,
      },
    });
    createExamSet(exam.id, {
      label: "A",
      questionOrder: [selected.id, other.id],
      shuffledOptions: [[0, 1, 2, 3, 4], [0, 1, 2, 3, 4]],
      correctShuffledIndices: [0, 0],
    });
    const initial = createExamVersion(exam.id);

    expect(getExam(exam.id)?.questionImageScaleOverrides).toEqual({ [selected.id]: 75 });
    expect(initial.snapshot.sets[0]?.questions[0]?.imageScalePercent).toBe(75);
    expect(buildPrintExamPayload(getExam(exam.id)!).sets[0]?.questions[0]?.imageScalePercent).toBe(75);
    expect(buildPrintExamPayload(getExam(exam.id)!, initial).sets[0]?.questions[0]?.imageScalePercent).toBe(75);

    const saved = saveExamVersion(exam.id, {
      title: "Escalas revisadas",
      institution: "UniFil",
      instructions: "Instruções",
      allowQuestionSplit: false,
      questionLayouts: {},
      questionLayoutOverrides: {},
      questionImageScaleOverrides: { [selected.id]: 50, [other.id]: null },
    });
    expect(saved.snapshot.sets[0]?.questions[0]?.imageScalePercent).toBe(50);
    expect(getExam(exam.id)?.questionImageScaleOverrides).toEqual({ [selected.id]: 50 });

    saveExamVersion(exam.id, {
      title: "Escalas preservadas",
      institution: "UniFil",
      instructions: "Instruções",
      allowQuestionSplit: false,
      questionLayouts: {},
      questionLayoutOverrides: {},
    });
    expect(getExam(exam.id)?.questionImageScaleOverrides).toEqual({ [selected.id]: 50 });

    const restored = restoreExamVersion(exam.id, initial.versionNumber);
    expect(restored.snapshot.sets[0]?.questions[0]?.imageScalePercent).toBe(75);
    expect(getExam(exam.id)?.questionImageScaleOverrides).toEqual({ [selected.id]: 75 });
  });

  it("normalizes historical snapshots without imageScalePercent to the default", () => {
    const question = addQuestion();
    const snapshot = parseExamVersionSnapshot({
      schemaVersion: 1,
      sourceExamId: 1,
      title: "Histórica",
      institution: "UniFil",
      instructions: "Instruções",
      answerKeyWidthPt: 350,
      allowQuestionSplit: false,
      questionLayouts: {},
      sets: [{
        sourceSetId: 1,
        label: "A",
        evalBeeImageUrl: null,
        questions: [{
          sourceQuestionId: question.id,
          sourceSetId: 1,
          position: 0,
          statementHtml: "<p>Q</p>",
          imageUrl: null,
          options: [{ index: 0, text: "A" }],
          shuffledOptions: [],
          correctShuffledIndex: 0,
          questionType: "dissertativa",
          answerLines: 0,
          layoutOverride: null,
          layout: "full",
          difficulty: "medium",
          thematicArea: null,
          correctIndex: 0,
          correctAnswer: "",
          explanation: "",
        }],
      }],
    });

    expect(snapshot?.sets[0]?.questions[0]?.imageScalePercent).toBe(100);
  });
});
