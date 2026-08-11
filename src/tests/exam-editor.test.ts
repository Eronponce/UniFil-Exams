import Database from "better-sqlite3";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirectWithToastMock = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }));
vi.mock("@/lib/toast", () => ({ redirectWithToast: redirectWithToastMock }));

import { createExam, createExamSet, createExamVersion, getExam, listExamVersions } from "@/lib/db/exams";
import { createQuestion } from "@/lib/db/questions";
import { migrate } from "@/lib/db/schema";
import { saveExamVersionAction } from "@/lib/actions/exams";

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
