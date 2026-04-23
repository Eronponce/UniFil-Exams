import type { Exam, ExamSet } from "@/types";
import { getDb } from "./client";

interface ExamRow {
  id: number;
  discipline_id: number;
  title: string;
  institution: string;
  created_at: string;
}

interface ExamSetRow {
  id: number;
  exam_id: number;
  label: string;
  evalbee_image_path: string | null;
  created_at: string;
}

interface ExamSetQuestionRow {
  set_id: number;
  question_id: number;
  position: number;
  shuffled_options: string;
  correct_shuffled_index: number;
}

function setToModel(row: ExamSetRow, sqRows: ExamSetQuestionRow[]): ExamSet {
  return {
    id: row.id,
    examId: row.exam_id,
    label: row.label,
    evalBeeImageUrl: row.evalbee_image_path,
    questions: sqRows
      .filter((sq) => sq.set_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((sq) => ({
        questionId: sq.question_id,
        position: sq.position,
        shuffledOptions: JSON.parse(sq.shuffled_options) as number[],
        correctShuffledIndex: sq.correct_shuffled_index,
      })),
    createdAt: row.created_at,
  };
}

const DEFAULT_INSTITUTION = "UniFil - Centro Universitário Filadélfia";

function examToModel(er: ExamRow, sets: ExamSet[]): Exam {
  return { id: er.id, disciplineId: er.discipline_id, title: er.title, institution: er.institution ?? DEFAULT_INSTITUTION, sets, createdAt: er.created_at };
}

export function listExams(): Exam[] {
  const db = getDb();
  const examRows = db.prepare("SELECT * FROM exams ORDER BY created_at DESC").all() as ExamRow[];
  return examRows.map((er) => {
    const setRows = db.prepare("SELECT * FROM exam_sets WHERE exam_id = ?").all(er.id) as ExamSetRow[];
    const sqRows = setRows.length
      ? (db.prepare(`SELECT * FROM exam_set_questions WHERE set_id IN (${setRows.map(() => "?").join(",")})`).all(...setRows.map((s) => s.id)) as ExamSetQuestionRow[])
      : [];
    return examToModel(er, setRows.map((sr) => setToModel(sr, sqRows)));
  });
}

export function getExam(id: number): Exam | undefined {
  const db = getDb();
  const er = db.prepare("SELECT * FROM exams WHERE id = ?").get(id) as ExamRow | undefined;
  if (!er) return undefined;
  const setRows = db.prepare("SELECT * FROM exam_sets WHERE exam_id = ?").all(id) as ExamSetRow[];
  const sqRows = setRows.length
    ? (db.prepare(`SELECT * FROM exam_set_questions WHERE set_id IN (${setRows.map(() => "?").join(",")})`).all(...setRows.map((s) => s.id)) as ExamSetQuestionRow[])
    : [];
  return examToModel(er, setRows.map((sr) => setToModel(sr, sqRows)));
}

export function listAllExamQuestionIds(): number[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT question_id FROM exam_questions ORDER BY question_id")
    .all() as { question_id: number }[];
  return rows.map((r) => r.question_id);
}

export function createExam(data: { disciplineId: number; title: string; institution?: string; questionIds: number[] }): Exam {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO exams (discipline_id, title, institution) VALUES (?, ?, ?)")
    .run(data.disciplineId, data.title, data.institution ?? DEFAULT_INSTITUTION);
  const examId = result.lastInsertRowid as number;
  const insertQ = db.prepare("INSERT INTO exam_questions (exam_id, question_id, position) VALUES (?, ?, ?)");
  data.questionIds.forEach((qid, pos) => insertQ.run(examId, qid, pos));
  return getExam(examId)!;
}

export interface ExamSetInput {
  label: string;
  questionOrder: number[];
  shuffledOptions: number[][];
  correctShuffledIndices: number[];
  evalBeeImagePath?: string;
}

export function createExamSet(examId: number, data: ExamSetInput): ExamSet {
  const db = getDb();
  const questionIds = data.questionOrder;
  const result = db
    .prepare("INSERT INTO exam_sets (exam_id, label, evalbee_image_path) VALUES (?, ?, ?)")
    .run(examId, data.label, data.evalBeeImagePath ?? null);
  const setId = result.lastInsertRowid as number;
  const insertSQ = db.prepare(
    "INSERT INTO exam_set_questions (set_id, question_id, position, shuffled_options, correct_shuffled_index) VALUES (?, ?, ?, ?, ?)"
  );
  questionIds.forEach((qid, pos) => {
    insertSQ.run(setId, qid, pos, JSON.stringify(data.shuffledOptions[pos]), data.correctShuffledIndices[pos]);
  });
  const setRow = db.prepare("SELECT * FROM exam_sets WHERE id = ?").get(setId) as ExamSetRow;
  const sqRows = db.prepare("SELECT * FROM exam_set_questions WHERE set_id = ?").all(setId) as ExamSetQuestionRow[];
  return setToModel(setRow, sqRows);
}
