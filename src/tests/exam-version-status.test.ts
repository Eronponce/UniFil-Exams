import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirectWithToastMock = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }));
vi.mock("@/lib/toast", () => ({ redirectWithToast: redirectWithToastMock }));

import { deleteExamAction, reactivateExamAction } from "@/lib/actions/exams";
import { createExam, createExamSet, createExamVersion, deactivateExam, getExam, listExams, reactivateExam } from "@/lib/db/exams";
import { createQuestion } from "@/lib/db/questions";
import { migrate } from "@/lib/db/schema";

function makeExam() {
  const question = createQuestion({ disciplineId: 1, statement: "<p>Q</p>", options: ["A", "B", "C", "D", "E"], correctIndex: 0 });
  const exam = createExam({ disciplineId: 1, title: "Preservada", questionIds: [question.id] });
  const set = createExamSet(exam.id, {
    label: "A",
    questionOrder: [question.id],
    shuffledOptions: [[0, 1, 2, 3, 4]],
    correctShuffledIndices: [0],
  });
  createExamVersion(exam.id);
  return { exam, set };
}

beforeEach(() => {
  db = new Database(":memory:");
  migrate();
  db.prepare("INSERT INTO disciplines (id, name, code) VALUES (1, 'História', 'HIS')").run();
  redirectWithToastMock.mockClear();
});

afterEach(() => db.close());

describe("exam active status", () => {
  it("migrates legacy exams to active and filters active/inactive/all", () => {
    db.close();
    db = new Database(":memory:");
    db.exec(`CREATE TABLE exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discipline_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    migrate();
    db.prepare("INSERT INTO disciplines (id, name, code) VALUES (1, 'História', 'HIS')").run();
    db.prepare("INSERT INTO exams (discipline_id, title) VALUES (1, 'Legada')").run();

    expect(listExams("ativas")[0]?.active).toBe(true);
    expect(listExams("inativas")).toHaveLength(0);
    expect(listExams("todas")).toHaveLength(1);
  });

  it("deactivation/reactivation preserves sets, version rows and question links", () => {
    const { exam, set } = makeExam();
    expect(deactivateExam(exam.id)?.active).toBe(false);
    expect(listExams("ativas")).toHaveLength(0);
    expect(listExams("inativas").map((item) => item.id)).toEqual([exam.id]);
    expect(getExam(exam.id)?.sets[0]?.id).toBe(set.id);
    expect(db.prepare("SELECT COUNT(*) AS count FROM exam_versions WHERE exam_id = ?").get(exam.id)).toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM exam_questions WHERE exam_id = ?").get(exam.id)).toEqual({ count: 1 });

    expect(reactivateExam(exam.id)?.active).toBe(true);
    expect(listExams("ativas").map((item) => item.id)).toEqual([exam.id]);
  });

  it("visible Inativar action does not remove history or sets", async () => {
    const { exam, set } = makeExam();
    const formData = new FormData();
    formData.set("id", String(exam.id));

    await expect(deleteExamAction(formData)).rejects.toThrow("REDIRECT");
    expect(getExam(exam.id)?.active).toBe(false);
    expect(getExam(exam.id)?.sets[0]?.id).toBe(set.id);
    expect(db.prepare("SELECT COUNT(*) AS count FROM exam_versions WHERE exam_id = ?").get(exam.id)).toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM exam_set_questions WHERE set_id = ?").get(set.id)).toEqual({ count: 1 });

    await expect(reactivateExamAction(formData)).rejects.toThrow("REDIRECT");
    expect(getExam(exam.id)?.active).toBe(true);
  });
});
