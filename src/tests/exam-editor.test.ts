import Database from "better-sqlite3";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirectWithToastMock = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }));
vi.mock("@/lib/toast", () => ({ redirectWithToast: redirectWithToastMock }));

import { createExam, createExamSet, createExamVersion, getExam, listExamVersions, listExams } from "@/lib/db/exams";
import { createQuestion } from "@/lib/db/questions";
import { migrate } from "@/lib/db/schema";
import { createExamAction, saveExamVersionAction } from "@/lib/actions/exams";

beforeEach(() => {
  db = new Database(":memory:");
  migrate();
  db.prepare("INSERT INTO disciplines (id, name, code) VALUES (1, 'História', 'HIS')").run();
  redirectWithToastMock.mockClear();
});

afterEach(() => db.close());

it("saves editor fields as a new immutable version with only selected overrides", async () => {
  const question = createQuestion({ disciplineId: 1, statement: "<p>Q</p>", options: ["A", "B", "C", "D", "E"], correctIndex: 0 });
  const exam = createExam({ disciplineId: 1, title: "Antes", questionIds: [question.id] });
  createExamSet(exam.id, {
    label: "A",
    questionOrder: [question.id],
    shuffledOptions: [[0, 1, 2, 3, 4]],
    correctShuffledIndices: [0],
  });
  createExamVersion(exam.id);

  const formData = new FormData();
  formData.set("examId", String(exam.id));
  formData.set("title", "Depois");
  formData.set("institution", "UniFil");
  formData.set("instructions", "Instruções editadas");
  formData.set("allowQuestionSplit", "1");
  formData.set("layoutObjetiva", "column");
  formData.set("layoutVF", "column");
  formData.set("layoutNumerica", "column");
  formData.set("layoutDissertativa", "full");
  formData.set(`layoutOverride-${question.id}`, "full");
  formData.set("changeNote", "Ajuste editorial");

  await expect(saveExamVersionAction(formData)).rejects.toThrow("REDIRECT");
  expect(listExamVersions(exam.id).map((version) => version.versionNumber)).toEqual([2, 1]);
  expect(listExamVersions(exam.id)[0]?.changeNote).toBe("Ajuste editorial");
  expect(getExam(exam.id)?.title).toBe("Depois");
  expect(getExam(exam.id)?.allowQuestionSplit).toBe(true);
  expect(getExam(exam.id)?.questionLayoutOverrides).toEqual({ [question.id]: "full" });
  expect(listExamVersions(exam.id)[1]?.snapshot.title).toBe("Antes");
});

it("filters initial full-width IDs after quantity selection and ignores invalid or non-selected IDs", async () => {
  const first = createQuestion({ disciplineId: 1, statement: "<p>Primeira</p>", options: ["A", "B", "C", "D", "E"], correctIndex: 0 });
  const second = createQuestion({ disciplineId: 1, statement: "<p>Segunda</p>", options: ["A", "B", "C", "D", "E"], correctIndex: 0 });
  const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
  const formData = new FormData();
  formData.set("disciplineId", "1");
  formData.set("title", "Montagem inicial");
  formData.set("quantitySets", "1");
  formData.set("numObjetivas", "1");
  formData.set("numVF", "0");
  formData.set("numNumericas", "0");
  formData.set("numDissertativas", "0");
  formData.append("questionIds", String(first.id));
  formData.append("questionIds", String(second.id));
  formData.append("fullWidthQuestionIds", String(second.id));
  formData.append("fullWidthQuestionIds", "0");
  formData.append("fullWidthQuestionIds", "not-an-id");

  try {
    await expect(createExamAction(formData)).rejects.toThrow("REDIRECT");
  } finally {
    random.mockRestore();
  }

  const exam = listExams("todas")[0]!;
  expect(exam.sets[0]?.questions.map((question) => question.questionId)).toEqual([first.id]);
  expect(exam.questionLayoutOverrides).toEqual({});
  expect(listExamVersions(exam.id)[0]?.snapshot.sets[0]?.questions[0]?.layout).toBe("column");
});

it("creates compact sets with column questions before full-width questions", async () => {
  const questions = ["A", "B", "C", "D"].map((statement) => createQuestion({
    disciplineId: 1,
    statement: `<p>${statement}</p>`,
    options: ["A", "B", "C", "D", "E"],
    correctIndex: 0,
  }));
  const formData = new FormData();
  formData.set("disciplineId", "1");
  formData.set("title", "Montagem compacta");
  formData.set("quantitySets", "1");
  formData.set("numObjetivas", "4");
  formData.set("numVF", "0");
  formData.set("numNumericas", "0");
  formData.set("numDissertativas", "0");
  formData.set("compactQuestionOrder", "1");
  for (const question of questions) formData.append("questionIds", String(question.id));
  formData.append("fullWidthQuestionIds", String(questions[1].id));
  formData.append("fullWidthQuestionIds", String(questions[3].id));

  await expect(createExamAction(formData)).rejects.toThrow("REDIRECT");

  const exam = listExams("todas")[0]!;
  const layouts = exam.sets[0]!.questions.map(({ questionId }) => exam.questionLayoutOverrides[questionId] ?? exam.questionLayouts.objetiva);
  expect(layouts).toEqual(["column", "column", "full", "full"]);
  expect(listExamVersions(exam.id)[0]!.snapshot.sets[0]!.questions.map((question) => question.layout)).toEqual(layouts);
});
