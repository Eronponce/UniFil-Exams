import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirectWithToastMock = vi.hoisted(() => vi.fn((url: string, toast?: Record<string, unknown>) => {
  void toast;
  throw new Error(`REDIRECT:${url}`);
}));
vi.mock("@/lib/toast", () => ({ redirectWithToast: redirectWithToastMock }));
const answerKeyUploadMocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  store: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/uploads/answer-key", () => ({
  AnswerKeyUploadError: class AnswerKeyUploadError extends Error {},
  prepareAnswerKeyUpload: answerKeyUploadMocks.prepare,
  storeAnswerKeyUpload: answerKeyUploadMocks.store,
  removeAnswerKeyFiles: answerKeyUploadMocks.remove,
}));

import { createExamAction } from "@/lib/actions/exams";
import { listExams } from "@/lib/db/exams";
import { migrate } from "@/lib/db/schema";
import { auditQuestion, createQuestion, getQuestion } from "@/lib/db/questions";

beforeEach(() => {
  db = new Database(":memory:");
  migrate();
  db.prepare("INSERT INTO disciplines (id, name, code) VALUES (1, 'História', 'HIS')").run();
  redirectWithToastMock.mockClear();
  answerKeyUploadMocks.prepare.mockReset().mockResolvedValue(null);
  answerKeyUploadMocks.store.mockReset();
  answerKeyUploadMocks.remove.mockReset();
});

afterEach(() => db.close());

function addQuestion(
  questionType: "objetiva" | "verdadeiro_falso" | "numerica" | "dissertativa",
  correctIndex = 0,
  imagePath?: string,
) {
  const question = createQuestion({
    disciplineId: 1,
    statement: `<p>${questionType}</p>`,
    options: questionType === "verdadeiro_falso" ? ["Verdadeiro", "Falso"] : ["A", "B", "C", "D", "E"],
    correctIndex,
    imagePath,
    questionType,
  });
  auditQuestion(question.id, true);
  return question;
}

describe("createExamAction visual builder contract", () => {
  it("persists exactly audited selections, canonical manual order, seeded sets, layout, and image scales", async () => {
    const objectiveColumn = addQuestion("objetiva", 1);
    const objectiveFull = addQuestion("objetiva", 2, "/uploads/objective.png");
    const vf = addQuestion("verdadeiro_falso", 1);
    const numeric = addQuestion("numerica");
    const discursive = addQuestion("dissertativa");
    const formData = new FormData();
    formData.set("visualBuilder", "1");
    formData.set("disciplineId", "1");
    formData.set("title", "Visual determinística");
    formData.set("institution", "UniFil");
    formData.set("quantitySets", "2");
    formData.set("draftSeed", "  visual-seed  ");
    formData.set("answerKeyWidthPt", "425");
    formData.set("answerKeyFile", new File(["imagem"], "gabarito.png", { type: "image/png" }));
    answerKeyUploadMocks.prepare.mockResolvedValue({ extension: "png", bytes: Buffer.from("imagem") });
    formData.set("layoutObjetiva", "column");
    formData.set("layoutVF", "column");
    formData.set("layoutNumerica", "column");
    formData.set("layoutDissertativa", "full");
    for (const question of [discursive, objectiveFull, vf, objectiveColumn, numeric]) {
      formData.append("questionIds", String(question.id));
    }
    for (const question of [objectiveFull, objectiveColumn, vf, numeric, discursive, objectiveFull]) {
      formData.append("manualQuestionOrder", String(question.id));
    }
    formData.set(`layoutOverride-${objectiveFull.id}`, "full");
    formData.set(`imageScale-${objectiveFull.id}`, "75");
    formData.set(`imageScale-${vf.id}`, "100");
    formData.set(`imageScale-${numeric.id}`, "101");

    await expect(createExamAction(formData)).rejects.toThrow("REDIRECT");

    const exam = listExams("todas")[0]!;
    const expectedOrder = [objectiveColumn.id, objectiveFull.id, vf.id, numeric.id, discursive.id];
    expect(exam.sets).toHaveLength(2);
    expect(exam.answerKeyWidthPt).toBe(425);
    expect(answerKeyUploadMocks.store).toHaveBeenCalledWith(exam.id, expect.objectContaining({ extension: "png" }));
    expect(exam.sets.map((set) => set.questions.map((question) => question.questionId))).toEqual([
      expectedOrder,
      expectedOrder,
    ]);
    expect(exam.questionImageScaleOverrides).toEqual({ [objectiveFull.id]: 75 });
    expect(db.prepare("SELECT image_scale_percent FROM exam_questions WHERE exam_id = ? AND question_id = ?").get(exam.id, objectiveFull.id)).toEqual({ image_scale_percent: 75 });
    expect(db.prepare("SELECT image_scale_percent FROM exam_questions WHERE exam_id = ? AND question_id = ?").get(exam.id, vf.id)).toEqual({ image_scale_percent: null });
    for (const set of exam.sets) {
      for (const setQuestion of set.questions) {
        const question = getQuestion(setQuestion.questionId)!;
        const shuffled = setQuestion.shuffledOptions;
        if (question.questionType === "objetiva" || question.questionType === "verdadeiro_falso") {
          expect(shuffled[setQuestion.correctShuffledIndex]).toBe(question.correctIndex);
        } else {
          expect(shuffled).toEqual([]);
        }
      }
    }
  });

  it("rejects a visual submission with no valid audited selection before creating an exam", async () => {
    const question = createQuestion({
      disciplineId: 1,
      statement: "<p>Não auditada</p>",
      options: ["A", "B", "C", "D", "E"],
      correctIndex: 0,
    });
    const formData = new FormData();
    formData.set("visualBuilder", "1");
    formData.set("disciplineId", "1");
    formData.set("title", "Sem auditoria");
    formData.append("questionIds", String(question.id));

    await expect(createExamAction(formData)).rejects.toThrow("REDIRECT");
    expect(listExams("todas")).toHaveLength(0);
  });

  it("rejects a partially stale visual selection atomically instead of creating a partial exam", async () => {
    const valid = addQuestion("objetiva");
    const notAudited = createQuestion({
      disciplineId: 1,
      statement: "<p>Não auditada</p>",
      options: ["A", "B", "C", "D", "E"],
      correctIndex: 0,
    });
    db.prepare("INSERT INTO disciplines (id, name, code) VALUES (2, 'Matemática', 'MAT')").run();
    const foreign = createQuestion({
      disciplineId: 2,
      statement: "<p>Outra disciplina</p>",
      options: ["A", "B", "C", "D", "E"],
      correctIndex: 0,
    });

    const formData = new FormData();
    formData.set("visualBuilder", "1");
    formData.set("disciplineId", "1");
    formData.set("title", "Seleção stale");
    formData.set("quantitySets", "2");
    for (const questionId of [valid.id, notAudited.id, foreign.id, 999999]) {
      formData.append("questionIds", String(questionId));
      formData.append("manualQuestionOrder", String(questionId));
    }

    await expect(createExamAction(formData)).rejects.toThrow("REDIRECT");
    expect(listExams("todas")).toHaveLength(0);
    expect(redirectWithToastMock.mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({
      title: "Seleção visual desatualizada",
    }));
  });

  it("removes the new exam if the attached answer key cannot be stored", async () => {
    const question = addQuestion("objetiva");
    const formData = new FormData();
    formData.set("visualBuilder", "1");
    formData.set("disciplineId", "1");
    formData.set("title", "Falha de upload");
    formData.set("answerKeyFile", new File(["imagem"], "gabarito.png", { type: "image/png" }));
    formData.append("questionIds", String(question.id));
    formData.append("manualQuestionOrder", String(question.id));
    answerKeyUploadMocks.prepare.mockResolvedValue({ extension: "png", bytes: Buffer.from("imagem") });
    answerKeyUploadMocks.store.mockImplementation(() => { throw new Error("disco indisponível"); });

    await expect(createExamAction(formData)).rejects.toThrow("REDIRECT");

    expect(listExams("todas")).toHaveLength(0);
    expect(answerKeyUploadMocks.remove).toHaveBeenCalled();
    expect(redirectWithToastMock.mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({
      title: "Não foi possível criar a prova",
    }));
  });
});

describe("exam_questions image scale schema migration", () => {
  it("adds the checked scale column safely to a legacy table", () => {
    db.close();
    db = new Database(":memory:");
    db.exec(`CREATE TABLE exam_questions (
      exam_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      layout_override TEXT,
      PRIMARY KEY (exam_id, question_id)
    )`);

    migrate();

    expect(db.prepare("PRAGMA table_info(exam_questions)").all()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "image_scale_percent" }),
    ]));
    expect(() => db.prepare("INSERT INTO exam_questions (exam_id, question_id, position, image_scale_percent) VALUES (1, 1, 0, 101)").run()).toThrow();
    expect(() => db.prepare("INSERT INTO exam_questions (exam_id, question_id, position, image_scale_percent) VALUES (1, 2, 0, 25.5)").run()).toThrow();
    db.prepare("INSERT INTO exam_questions (exam_id, question_id, position, image_scale_percent) VALUES (1, 1, 0, 99)").run();
    expect(db.prepare("SELECT image_scale_percent FROM exam_questions").get()).toEqual({ image_scale_percent: 99 });
  });
});
