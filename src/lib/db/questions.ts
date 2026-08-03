import type { Question, QuestionOption, QuestionType } from "@/types";
import { getDb } from "./client";

interface QuestionRow {
  id: number;
  discipline_id: number;
  statement: string;
  options: string;
  correct_index: number;
  image_path: string | null;
  difficulty: "easy" | "medium" | "hard";
  source: "manual" | "ai";
  audited: number;
  rejected: number;
  thematic_area: string | null;
  explanation: string;
  question_type: QuestionType;
  answer_lines: number;
  correct_answer: string;
  created_at: string;
}

function toModel(row: QuestionRow): Question {
  const opts: string[] = JSON.parse(row.options) as string[];
  return {
    id: row.id,
    disciplineId: row.discipline_id,
    statement: row.statement,
    imageUrl: row.image_path,
    options: opts.map((text, index): QuestionOption => ({ index, text })),
    correctIndex: row.correct_index,
    difficulty: row.difficulty,
    source: row.source,
    audited: row.audited === 1,
    rejected: row.rejected === 1,
    thematicArea: row.thematic_area ?? null,
    explanation: row.explanation ?? "",
    questionType: (row.question_type ?? "objetiva") as QuestionType,
    answerLines: row.answer_lines ?? 0,
    correctAnswer: row.correct_answer ?? "",
    createdAt: row.created_at,
  };
}

export function listQuestions(disciplineId?: number): Question[] {
  const db = getDb();
  const rows = disciplineId
    ? (db.prepare("SELECT * FROM questions WHERE discipline_id = ? ORDER BY created_at DESC, id DESC").all(disciplineId) as QuestionRow[])
    : (db.prepare("SELECT * FROM questions ORDER BY created_at DESC, id DESC").all() as QuestionRow[]);
  return rows.map(toModel);
}

export function getQuestion(id: number): Question | undefined {
  const row = getDb().prepare("SELECT * FROM questions WHERE id = ?").get(id) as QuestionRow | undefined;
  return row ? toModel(row) : undefined;
}

export interface CreateQuestionInput {
  disciplineId: number;
  statement: string;
  options: string[];
  correctIndex: number;
  imagePath?: string;
  difficulty?: "easy" | "medium" | "hard";
  source?: "manual" | "ai";
  thematicArea?: string;
  explanation?: string;
  questionType?: QuestionType;
  answerLines?: number;
  correctAnswer?: string;
}

export function createQuestion(data: CreateQuestionInput): Question {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO questions
        (discipline_id, statement, options, correct_index, image_path, difficulty, source, thematic_area, explanation, question_type, answer_lines, correct_answer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.disciplineId,
      data.statement,
      JSON.stringify(data.options),
      data.correctIndex,
      data.imagePath ?? null,
      data.difficulty ?? "medium",
      data.source ?? "manual",
      data.thematicArea ?? null,
      data.explanation ?? "",
      data.questionType ?? "objetiva",
      data.answerLines ?? 0,
      data.correctAnswer ?? ""
    );
  return getQuestion(result.lastInsertRowid as number)!;
}

export function auditQuestion(id: number, audited: boolean): void {
  getDb().prepare("UPDATE questions SET audited = ? WHERE id = ?").run(audited ? 1 : 0, id);
}

export function rejectQuestion(id: number, rejected: boolean): void {
  getDb().prepare("UPDATE questions SET rejected = ?, audited = 0 WHERE id = ?").run(rejected ? 1 : 0, id);
}

export function updateQuestion(id: number, data: Partial<Omit<CreateQuestionInput, "disciplineId">>): Question | undefined {
  const db = getDb();
  if (data.statement !== undefined) db.prepare("UPDATE questions SET statement = ? WHERE id = ?").run(data.statement, id);
  if (data.options !== undefined) db.prepare("UPDATE questions SET options = ? WHERE id = ?").run(JSON.stringify(data.options), id);
  if (data.correctIndex !== undefined) db.prepare("UPDATE questions SET correct_index = ? WHERE id = ?").run(data.correctIndex, id);
  if (data.imagePath !== undefined) db.prepare("UPDATE questions SET image_path = ? WHERE id = ?").run(data.imagePath, id);
  if (data.difficulty !== undefined) db.prepare("UPDATE questions SET difficulty = ? WHERE id = ?").run(data.difficulty, id);
  if (data.thematicArea !== undefined) db.prepare("UPDATE questions SET thematic_area = ? WHERE id = ?").run(data.thematicArea || null, id);
  if (data.explanation !== undefined) db.prepare("UPDATE questions SET explanation = ? WHERE id = ?").run(data.explanation, id);
  if (data.questionType !== undefined) db.prepare("UPDATE questions SET question_type = ? WHERE id = ?").run(data.questionType, id);
  if (data.answerLines !== undefined) db.prepare("UPDATE questions SET answer_lines = ? WHERE id = ?").run(data.answerLines, id);
  if (data.correctAnswer !== undefined) db.prepare("UPDATE questions SET correct_answer = ? WHERE id = ?").run(data.correctAnswer, id);
  return getQuestion(id);
}

export interface BatchQuestionUpdate {
  id: number;
  statement: string;
  thematicArea?: string | null;
}

/** Updates exactly the two fields exposed by the bulk editor, atomically. */
export function updateQuestionsStatementAndThematicArea(updates: BatchQuestionUpdate[]): number {
  if (updates.length === 0) throw new Error("Selecione ao menos uma questão.");

  const normalized = updates.map((update) => ({
    id: update.id,
    statement: update.statement.trim(),
    thematicArea: update.thematicArea?.trim() || null,
  }));
  const ids = new Set<number>();
  for (const update of normalized) {
    if (!Number.isInteger(update.id) || update.id <= 0) throw new Error("ID de questão inválido.");
    if (ids.has(update.id)) throw new Error("Uma questão não pode ser enviada mais de uma vez.");
    if (!update.statement) throw new Error("O enunciado não pode ficar vazio.");
    ids.add(update.id);
  }

  const db = getDb();
  const placeholders = normalized.map(() => "?").join(", ");
  const transaction = db.transaction((items: typeof normalized) => {
    const found = db.prepare(`SELECT id FROM questions WHERE id IN (${placeholders})`).all(...items.map((item) => item.id)) as { id: number }[];
    if (found.length !== items.length) throw new Error("Uma ou mais questões não existem mais.");

    const update = db.prepare("UPDATE questions SET statement = ?, thematic_area = ? WHERE id = ?");
    for (const item of items) update.run(item.statement, item.thematicArea, item.id);
  });
  transaction(normalized);
  return normalized.length;
}

export interface QuestionNavigation {
  previousId?: number;
  nextId?: number;
}

/** Returns adjacent questions in the visible (newest-first) discipline order. */
export function getQuestionNavigation(questionId: number, disciplineId: number): QuestionNavigation {
  const rows = getDb()
    .prepare("SELECT id FROM questions WHERE discipline_id = ? ORDER BY created_at DESC, id DESC")
    .all(disciplineId) as { id: number }[];
  const index = rows.findIndex((row) => row.id === questionId);
  if (index === -1) return {};
  return {
    previousId: rows[index - 1]?.id,
    nextId: rows[index + 1]?.id,
  };
}

export function deleteQuestion(id: number): void {
  const db = getDb();
  const tx = db.transaction((questionId: number) => {
    db.prepare("DELETE FROM exam_set_questions WHERE question_id = ?").run(questionId);
    db.prepare("DELETE FROM exam_questions WHERE question_id = ?").run(questionId);
    db.prepare("DELETE FROM questions WHERE id = ?").run(questionId);
  });
  tx(id);
}

export function deleteQuestions(ids: number[]): void {
  if (ids.length === 0) return;
  const db = getDb();
  const ph = ids.map(() => "?").join(",");
  const tx = db.transaction((questionIds: number[]) => {
    db.prepare(`DELETE FROM exam_set_questions WHERE question_id IN (${ph})`).run(...questionIds);
    db.prepare(`DELETE FROM exam_questions WHERE question_id IN (${ph})`).run(...questionIds);
    db.prepare(`DELETE FROM questions WHERE id IN (${ph})`).run(...questionIds);
  });
  tx(ids);
}
