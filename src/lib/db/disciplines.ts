import type { Discipline } from "@/types";
import { getDb } from "./client";

interface DisciplineRow {
  id: number;
  name: string;
  code: string;
  active: number;
  created_at: string;
}

function toModel(row: DisciplineRow): Discipline {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    createdAt: row.created_at,
  };
}

export function listDisciplines(): Discipline[] {
  return (getDb().prepare("SELECT * FROM disciplines WHERE active = 1 ORDER BY name").all() as DisciplineRow[]).map(toModel);
}

export function getDiscipline(id: number): Discipline | undefined {
  const row = getDb().prepare("SELECT * FROM disciplines WHERE id = ?").get(id) as DisciplineRow | undefined;
  return row ? toModel(row) : undefined;
}

export function getDisciplineByCode(code: string): Discipline | undefined {
  const row = getDb().prepare("SELECT * FROM disciplines WHERE code = ? AND active = 1").get(code.toUpperCase()) as DisciplineRow | undefined;
  return row ? toModel(row) : undefined;
}

export function createDiscipline(data: { name: string; code: string }): Discipline {
  const db = getDb();
  const result = db.prepare("INSERT INTO disciplines (name, code) VALUES (?, ?)").run(data.name, data.code.toUpperCase());
  return getDiscipline(result.lastInsertRowid as number)!;
}

export function updateDiscipline(id: number, data: { name?: string; code?: string }): Discipline | undefined {
  const db = getDb();
  if (data.name !== undefined) db.prepare("UPDATE disciplines SET name = ? WHERE id = ?").run(data.name, id);
  if (data.code !== undefined) db.prepare("UPDATE disciplines SET code = ? WHERE id = ?").run(data.code.toUpperCase(), id);
  return getDiscipline(id);
}

export function deleteDiscipline(id: number): void {
  getDb().prepare("UPDATE disciplines SET active = 0 WHERE id = ?").run(id);
}
