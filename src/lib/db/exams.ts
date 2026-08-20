import type { Exam, ExamQuestionLayouts, ExamSet, QuestionLayout } from "@/types";
import { clampAnswerKeyWidth, ANSWER_KEY_DEFAULT_WIDTH_PT } from "@/lib/pdf/answer-key-layout";
import { normalizeExamQuestionLayouts } from "@/lib/exam/layout";
import { normalizeExamInstructions } from "@/lib/exam/instructions";
import {
  isValidQuestionImageScalePercent,
} from "@/lib/print/question-image-scale";
import {
  buildExamVersionSnapshot,
  cloneExamVersionSnapshot,
  parseExamVersionSnapshot,
  type ExamVersion,
  type ExamVersionSnapshot,
} from "@/lib/exam/version";
import { getQuestion } from "./questions";
import { getDb } from "./client";

interface ExamRow {
  id: number;
  discipline_id: number;
  title: string;
  institution: string;
  instructions: string | null;
  active: number | null;
  allow_question_split: number | null;
  answer_key_width_pt: number | null;
  layout_objetiva: string | null;
  layout_verdadeiro_falso: string | null;
  layout_numerica: string | null;
  layout_dissertativa: string | null;
  created_at: string;
}

interface ExamQuestionLayoutRow {
  question_id: number;
  layout_override: string | null;
}

interface ExamQuestionImageScaleRow {
  question_id: number;
  image_scale_percent: number | null;
}

interface ExamVersionRow {
  id: number;
  exam_id: number;
  version_number: number;
  change_note: string;
  snapshot_json: string;
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

function examToModel(
  er: ExamRow,
  sets: ExamSet[],
  questionLayoutOverrides: Record<number, QuestionLayout>,
  questionImageScaleOverrides: Record<number, number>,
): Exam {
  return {
    id: er.id,
    disciplineId: er.discipline_id,
    title: er.title,
    institution: er.institution ?? DEFAULT_INSTITUTION,
    instructions: normalizeExamInstructions(er.instructions),
    active: Number(er.active ?? 1) === 1,
    allowQuestionSplit: Number(er.allow_question_split) === 1,
    answerKeyWidthPt: clampAnswerKeyWidth(er.answer_key_width_pt ?? ANSWER_KEY_DEFAULT_WIDTH_PT),
    questionLayouts: normalizeExamQuestionLayouts({
      objetiva: er.layout_objetiva,
      verdadeiro_falso: er.layout_verdadeiro_falso,
      numerica: er.layout_numerica,
      dissertativa: er.layout_dissertativa,
    }),
    questionLayoutOverrides,
    questionImageScaleOverrides,
    sets,
    createdAt: er.created_at,
  };
}

export type ExamStatusFilter = "ativas" | "inativas" | "todas";

function loadQuestionLayoutOverrides(examId: number): Record<number, QuestionLayout> {
  const rows = getDb()
    .prepare("SELECT question_id, layout_override FROM exam_questions WHERE exam_id = ? AND layout_override IS NOT NULL")
    .all(examId) as ExamQuestionLayoutRow[];
  const overrides: Record<number, QuestionLayout> = {};
  for (const row of rows) {
    if (row.layout_override === "column" || row.layout_override === "full") {
      overrides[row.question_id] = row.layout_override;
    }
  }
  return overrides;
}

function loadQuestionImageScaleOverrides(examId: number): Record<number, number> {
  const rows = getDb()
    .prepare("SELECT question_id, image_scale_percent FROM exam_questions WHERE exam_id = ? AND image_scale_percent IS NOT NULL")
    .all(examId) as ExamQuestionImageScaleRow[];
  const overrides: Record<number, number> = {};
  for (const row of rows) {
    if (isValidQuestionImageScalePercent(row.image_scale_percent) && row.image_scale_percent !== 100) {
      overrides[row.question_id] = row.image_scale_percent;
    }
  }
  return overrides;
}

export function listExams(status: ExamStatusFilter = "ativas"): Exam[] {
  const db = getDb();
  const where = status === "todas" ? "" : " WHERE active = ?";
  const params = status === "todas" ? [] : [status === "ativas" ? 1 : 0];
  const examRows = db.prepare(`SELECT * FROM exams${where} ORDER BY created_at DESC`).all(...params) as ExamRow[];
  return examRows.map((er) => {
    const setRows = db.prepare("SELECT * FROM exam_sets WHERE exam_id = ?").all(er.id) as ExamSetRow[];
    const sqRows = setRows.length
      ? (db.prepare(`SELECT * FROM exam_set_questions WHERE set_id IN (${setRows.map(() => "?").join(",")})`).all(...setRows.map((s) => s.id)) as ExamSetQuestionRow[])
      : [];
    return examToModel(
      er,
      setRows.map((sr) => setToModel(sr, sqRows)),
      loadQuestionLayoutOverrides(er.id),
      loadQuestionImageScaleOverrides(er.id),
    );
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
  return examToModel(
    er,
    setRows.map((sr) => setToModel(sr, sqRows)),
    loadQuestionLayoutOverrides(id),
    loadQuestionImageScaleOverrides(id),
  );
}

export function listAllExamQuestionIds(): number[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT question_id FROM exam_questions ORDER BY question_id")
    .all() as { question_id: number }[];
  return rows.map((r) => r.question_id);
}

export function createExam(data: {
  disciplineId: number;
  title: string;
  institution?: string;
  instructions?: string;
  allowQuestionSplit?: boolean;
  answerKeyWidthPt?: number;
  questionIds: number[];
  questionLayouts?: Partial<ExamQuestionLayouts>;
  questionLayoutOverrides?: Record<number, QuestionLayout | null>;
  questionImageScaleOverrides?: Record<number, number | null>;
}): Exam {
  const db = getDb();
  const layouts = normalizeExamQuestionLayouts(data.questionLayouts);
  const selectedQuestionIds = new Set(data.questionIds);
  const overrides = new Map<number, QuestionLayout>();
  for (const [rawQuestionId, layout] of Object.entries(data.questionLayoutOverrides ?? {})) {
    const questionId = Number(rawQuestionId);
    if (!selectedQuestionIds.has(questionId)) continue;
    if (layout === "column" || layout === "full") overrides.set(questionId, layout);
  }
  const imageScaleOverrides = new Map<number, number>();
  for (const [rawQuestionId, value] of Object.entries(data.questionImageScaleOverrides ?? {})) {
    const questionId = Number(rawQuestionId);
    if (!selectedQuestionIds.has(questionId)) continue;
    if (isValidQuestionImageScalePercent(value) && value !== 100) imageScaleOverrides.set(questionId, value);
  }

  let examId = 0;
  const create = db.transaction(() => {
    const result = db
      .prepare(`INSERT INTO exams (
        discipline_id, title, institution, allow_question_split, answer_key_width_pt,
        instructions, layout_objetiva, layout_verdadeiro_falso, layout_numerica, layout_dissertativa
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        data.disciplineId,
        data.title,
        data.institution ?? DEFAULT_INSTITUTION,
        data.allowQuestionSplit ? 1 : 0,
        clampAnswerKeyWidth(data.answerKeyWidthPt ?? ANSWER_KEY_DEFAULT_WIDTH_PT),
        normalizeExamInstructions(data.instructions),
        layouts.objetiva,
        layouts.verdadeiro_falso,
        layouts.numerica,
        layouts.dissertativa,
      );
    examId = result.lastInsertRowid as number;
    const insertQ = db.prepare("INSERT INTO exam_questions (exam_id, question_id, position, layout_override, image_scale_percent) VALUES (?, ?, ?, ?, ?)");
    data.questionIds.forEach((qid, pos) => insertQ.run(examId, qid, pos, overrides.get(qid) ?? null, imageScaleOverrides.get(qid) ?? null));
  });
  create();
  return getExam(examId)!;
}

export function deactivateExam(id: number): Exam | undefined {
  const existing = getExam(id);
  if (!existing) return undefined;
  getDb().prepare("UPDATE exams SET active = 0 WHERE id = ?").run(id);
  return getExam(id);
}

export function reactivateExam(id: number): Exam | undefined {
  const existing = getExam(id);
  if (!existing) return undefined;
  getDb().prepare("UPDATE exams SET active = 1 WHERE id = ?").run(id);
  return getExam(id);
}

export function updateExamAnswerKeyWidth(examId: number, widthPt: number): number {
  const normalizedWidth = clampAnswerKeyWidth(widthPt);
  getDb().prepare("UPDATE exams SET answer_key_width_pt = ? WHERE id = ?").run(normalizedWidth, examId);
  return normalizedWidth;
}

export function deleteExam(id: number): Exam | undefined {
  const db = getDb();
  const existing = getExam(id);
  if (!existing) return undefined;

  const tx = db.transaction((examId: number) => {
    db.prepare("DELETE FROM exam_set_questions WHERE set_id IN (SELECT id FROM exam_sets WHERE exam_id = ?)").run(examId);
    db.prepare("DELETE FROM exam_questions WHERE exam_id = ?").run(examId);
    db.prepare("DELETE FROM exam_sets WHERE exam_id = ?").run(examId);
    db.prepare("DELETE FROM exams WHERE id = ?").run(examId);
  });
  tx(id);
  return existing;
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

function mapVersionRow(row: ExamVersionRow): ExamVersion | undefined {
  const snapshot = parseExamVersionSnapshot(row.snapshot_json);
  if (!snapshot) return undefined;
  return {
    id: row.id,
    examId: row.exam_id,
    versionNumber: row.version_number,
    changeNote: row.change_note,
    snapshot,
    createdAt: row.created_at,
  };
}

function insertVersion(examId: number, snapshot: ExamVersionSnapshot, changeNote: string): number {
  const db = getDb();
  const next = db
    .prepare("SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM exam_versions WHERE exam_id = ?")
    .get(examId) as { next_version: number };
  const result = db
    .prepare("INSERT INTO exam_versions (exam_id, version_number, change_note, snapshot_json) VALUES (?, ?, ?, ?)")
    .run(examId, next.next_version, changeNote.trim(), JSON.stringify(snapshot));
  return result.lastInsertRowid as number;
}

export function listExamVersions(examId: number): ExamVersion[] {
  const rows = getDb()
    .prepare("SELECT * FROM exam_versions WHERE exam_id = ? ORDER BY version_number DESC")
    .all(examId) as ExamVersionRow[];
  return rows.map(mapVersionRow).filter((version): version is ExamVersion => version !== undefined);
}

export function hasExamVersions(examId: number): boolean {
  return Boolean(getDb().prepare("SELECT 1 AS present FROM exam_versions WHERE exam_id = ? LIMIT 1").get(examId));
}

export function getExamVersion(examId: number, versionNumber?: number): ExamVersion | undefined {
  const row = versionNumber === undefined
    ? getDb().prepare("SELECT * FROM exam_versions WHERE exam_id = ? ORDER BY version_number DESC LIMIT 1").get(examId)
    : getDb().prepare("SELECT * FROM exam_versions WHERE exam_id = ? AND version_number = ?").get(examId, versionNumber);
  return row ? mapVersionRow(row as ExamVersionRow) : undefined;
}

export function createExamVersion(examId: number, changeNote = "Versão inicial"): ExamVersion {
  const exam = getExam(examId);
  if (!exam) throw new Error("Prova não encontrada.");
  if (exam.sets.length === 0) throw new Error("A versão inicial exige ao menos um set.");
  const snapshot = buildExamVersionSnapshot(exam, getQuestion);
  const id = insertVersion(examId, snapshot, changeNote);
  const row = getDb().prepare("SELECT * FROM exam_versions WHERE id = ?").get(id) as ExamVersionRow;
  const version = mapVersionRow(row);
  if (!version) throw new Error("Não foi possível ler a versão inicial criada.");
  return version;
}

export interface ExamVersionEditorInput {
  title: string;
  institution: string;
  instructions: string;
  allowQuestionSplit: boolean;
  questionLayouts: Partial<Record<keyof ExamQuestionLayouts, unknown>>;
  questionLayoutOverrides: Record<number, QuestionLayout | null>;
  /** Undefined preserves current values; a defined map applies normalized values. */
  questionImageScaleOverrides?: Record<number, number | null>;
  changeNote?: string;
}

function normalizedOverrides(examId: number, input: Record<number, QuestionLayout | null>): Record<number, QuestionLayout> {
  const selected = new Set(
    (getDb().prepare("SELECT question_id FROM exam_questions WHERE exam_id = ?").all(examId) as { question_id: number }[])
      .map((row) => row.question_id),
  );
  const result: Record<number, QuestionLayout> = {};
  for (const [rawId, value] of Object.entries(input)) {
    const questionId = Number(rawId);
    if (!selected.has(questionId) || (value !== "column" && value !== "full")) continue;
    result[questionId] = value;
  }
  return result;
}

function normalizedImageScaleOverrides(examId: number, input: Record<number, number | null>): Record<number, number> {
  const selected = new Set(
    (getDb().prepare("SELECT question_id FROM exam_questions WHERE exam_id = ?").all(examId) as { question_id: number }[])
      .map((row) => row.question_id),
  );
  const result: Record<number, number> = {};
  for (const [rawId, value] of Object.entries(input)) {
    const questionId = Number(rawId);
    if (!selected.has(questionId)) continue;
    // Invalid, null, and 100 all normalize to the non-persisted default.
    result[questionId] = isValidQuestionImageScalePercent(value) ? value : 100;
  }
  return result;
}

function applyCurrentVersionSettings(
  examId: number,
  input: ExamVersionEditorInput,
  overrides: Record<number, QuestionLayout>,
  imageScaleOverrides?: Record<number, number>,
): void {
  const db = getDb();
  const layouts = normalizeExamQuestionLayouts(input.questionLayouts);
  db.prepare(`UPDATE exams SET
    title = ?, institution = ?, instructions = ?, allow_question_split = ?,
    layout_objetiva = ?, layout_verdadeiro_falso = ?, layout_numerica = ?, layout_dissertativa = ?
    WHERE id = ?`).run(
    input.title.trim(),
    input.institution.trim() || DEFAULT_INSTITUTION,
    normalizeExamInstructions(input.instructions),
    input.allowQuestionSplit ? 1 : 0,
    layouts.objetiva,
    layouts.verdadeiro_falso,
    layouts.numerica,
    layouts.dissertativa,
    examId,
  );
  db.prepare("UPDATE exam_questions SET layout_override = NULL WHERE exam_id = ?").run(examId);
  const update = db.prepare("UPDATE exam_questions SET layout_override = ? WHERE exam_id = ? AND question_id = ?");
  for (const [questionId, layout] of Object.entries(overrides)) update.run(layout, examId, Number(questionId));
  if (imageScaleOverrides !== undefined) {
    db.prepare("UPDATE exam_questions SET image_scale_percent = NULL WHERE exam_id = ?").run(examId);
    const updateScale = db.prepare("UPDATE exam_questions SET image_scale_percent = ? WHERE exam_id = ? AND question_id = ?");
    for (const [questionId, value] of Object.entries(imageScaleOverrides)) {
      if (value !== 100) updateScale.run(value, examId, Number(questionId));
    }
  }
}

export function saveExamVersion(examId: number, input: ExamVersionEditorInput): ExamVersion {
  const current = getExam(examId);
  if (!current) throw new Error("Prova não encontrada.");
  if (!input.title.trim()) throw new Error("O título da prova é obrigatório.");

  const db = getDb();
  let newVersionId = 0;
  const tx = db.transaction(() => {
    if (!getExamVersion(examId)) {
      const baseline = buildExamVersionSnapshot(current, getQuestion);
      insertVersion(examId, baseline, "Baseline legado");
    }
    const overrides = normalizedOverrides(examId, input.questionLayoutOverrides);
    const imageScaleOverrides = input.questionImageScaleOverrides === undefined
      ? undefined
      : normalizedImageScaleOverrides(examId, input.questionImageScaleOverrides);
    applyCurrentVersionSettings(examId, input, overrides, imageScaleOverrides);
    const updated = getExam(examId);
    if (!updated) throw new Error("Prova não encontrada após atualização.");
    const snapshot = buildExamVersionSnapshot(updated, getQuestion);
    newVersionId = insertVersion(examId, snapshot, input.changeNote ?? "");
  });
  tx();
  const row = getDb().prepare("SELECT * FROM exam_versions WHERE id = ?").get(newVersionId) as ExamVersionRow;
  const version = mapVersionRow(row);
  if (!version) throw new Error("Não foi possível ler a versão criada.");
  return version;
}

export function restoreExamVersion(examId: number, versionNumber: number, changeNote?: string): ExamVersion {
  const current = getExam(examId);
  const source = getExamVersion(examId, versionNumber);
  if (!current || !source) throw new Error("Versão da prova não encontrada.");

  const snapshot = cloneExamVersionSnapshot(source.snapshot);
  const db = getDb();
  let newVersionId = 0;
  const tx = db.transaction(() => {
    if (!getExamVersion(examId)) {
      insertVersion(examId, buildExamVersionSnapshot(current, getQuestion), "Baseline legado");
    }
    const overrides: Record<number, QuestionLayout> = {};
    const imageScaleInput: Record<number, number | null> = {};
    for (const set of snapshot.sets) {
      for (const question of set.questions) {
        if (question.layoutOverride) overrides[question.sourceQuestionId] = question.layoutOverride;
        imageScaleInput[question.sourceQuestionId] = question.imageScalePercent ?? 100;
      }
    }
    const input: ExamVersionEditorInput = {
      title: snapshot.title,
      institution: snapshot.institution,
      instructions: snapshot.instructions,
      allowQuestionSplit: snapshot.allowQuestionSplit,
      questionLayouts: snapshot.questionLayouts,
      questionLayoutOverrides: overrides,
      questionImageScaleOverrides: imageScaleInput,
    };
    applyCurrentVersionSettings(
      examId,
      input,
      normalizedOverrides(examId, overrides),
      normalizedImageScaleOverrides(examId, imageScaleInput),
    );
    newVersionId = insertVersion(examId, snapshot, changeNote ?? `Restaurada da versão ${versionNumber}`);
  });
  tx();
  const row = getDb().prepare("SELECT * FROM exam_versions WHERE id = ?").get(newVersionId) as ExamVersionRow;
  const version = mapVersionRow(row);
  if (!version) throw new Error("Não foi possível ler a versão restaurada.");
  return version;
}
