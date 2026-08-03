import type { Question, QuestionType } from "@/types";
import { normalizeThematicAreas } from "@/lib/questions/thematic-areas";
import { getDb } from "./client";

export { normalizeThematicAreas } from "@/lib/questions/thematic-areas";

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
  const opts = JSON.parse(row.options) as string[];
  return {
    id: row.id,
    disciplineId: row.discipline_id,
    statement: row.statement,
    imageUrl: row.image_path,
    options: opts.map((text, index) => ({ index, text })),
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

export interface QuestionFilters {
  disciplineId?: number;
  audited?: boolean;
  rejected?: boolean;
  search?: string;
  /** Preferred multi-value thematic-area filter. */
  thematicAreas?: readonly string[];
  /** Legacy single-value thematic-area filter. */
  thematicArea?: string;
  questionType?: QuestionType;
}

export function listQuestionsFiltered(filters: QuestionFilters = {}): Question[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.disciplineId !== undefined) {
    conditions.push("q.discipline_id = ?");
    params.push(filters.disciplineId);
  }
  if (filters.audited !== undefined) {
    conditions.push("q.audited = ?");
    params.push(filters.audited ? 1 : 0);
  }
  if (filters.rejected !== undefined) {
    conditions.push("q.rejected = ?");
    params.push(filters.rejected ? 1 : 0);
  }
  if (filters.search) {
    conditions.push("q.statement LIKE ?");
    params.push(`%${filters.search}%`);
  }
  const thematicAreas = normalizeThematicAreas(filters.thematicAreas, filters.thematicArea);
  if (thematicAreas.length > 0) {
    conditions.push(`q.thematic_area IN (${thematicAreas.map(() => "?").join(", ")})`);
    params.push(...thematicAreas);
  }
  if (filters.questionType) {
    conditions.push("q.question_type = ?");
    params.push(filters.questionType);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return (db.prepare(`SELECT * FROM questions q ${where} ORDER BY q.created_at DESC, q.id DESC`).all(...params) as QuestionRow[]).map(toModel);
}
