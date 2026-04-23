import type { Question } from "@/types";
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
  thematic_area: string | null;
  explanation: string;
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
    thematicArea: row.thematic_area ?? null,
    explanation: row.explanation ?? "",
    createdAt: row.created_at,
  };
}

export interface QuestionFilters {
  disciplineId?: number;
  audited?: boolean;
  search?: string;
  thematicArea?: string;
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
  if (filters.search) {
    conditions.push("q.statement LIKE ?");
    params.push(`%${filters.search}%`);
  }
  if (filters.thematicArea) {
    conditions.push("q.thematic_area = ?");
    params.push(filters.thematicArea);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return (db.prepare(`SELECT * FROM questions q ${where} ORDER BY q.created_at DESC`).all(...params) as QuestionRow[]).map(toModel);
}
