import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let db: Database.Database;

vi.mock("@/lib/db/client", () => ({ getDb: () => db }));

import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { normalizeThematicAreas } from "@/lib/questions/thematic-areas";
import { getQuestionNavigation, updateQuestionsStatementAndThematicArea, updateQuestionsThematicArea } from "@/lib/db/questions";

function addQuestion(id: number, disciplineId: number, statement: string, thematicArea: string | null, createdAt: string) {
  db.prepare("INSERT INTO questions (id, discipline_id, statement, thematic_area, created_at) VALUES (?, ?, ?, ?, ?)").run(id, disciplineId, statement, thematicArea, createdAt);
}

beforeEach(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE questions (
      id INTEGER PRIMARY KEY,
      discipline_id INTEGER NOT NULL,
      statement TEXT NOT NULL CHECK(statement <> 'explode'),
      options TEXT NOT NULL DEFAULT '[]',
      correct_index INTEGER NOT NULL DEFAULT 0,
      image_path TEXT,
      difficulty TEXT NOT NULL DEFAULT 'medium',
      source TEXT NOT NULL DEFAULT 'manual',
      audited INTEGER NOT NULL DEFAULT 0,
      rejected INTEGER NOT NULL DEFAULT 0,
      thematic_area TEXT,
      explanation TEXT NOT NULL DEFAULT '',
      question_type TEXT NOT NULL DEFAULT 'objetiva',
      answer_lines INTEGER NOT NULL DEFAULT 0,
      correct_answer TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);
});

afterEach(() => db.close());

describe("thematic-area filters", () => {
  it("normalizes repeated areas, removes blanks/duplicates, and prefers non-empty multi values", () => {
    expect(normalizeThematicAreas([" Álgebra ", "", "Geometria", "Álgebra"], "Legado")).toEqual(["Álgebra", "Geometria"]);
    expect(normalizeThematicAreas([], " Legado ")).toEqual(["Legado"]);
  });

  it("uses union semantics and remains compatible with the singular filter", () => {
    addQuestion(1, 1, "Álgebra", "Álgebra", "2026-01-02");
    addQuestion(2, 1, "Geometria", "Geometria", "2026-01-02");
    addQuestion(3, 1, "Cálculo", "Cálculo", "2026-01-02");

    expect(listQuestionsFiltered({ thematicAreas: [" Álgebra ", "Geometria", "Álgebra"], thematicArea: "Cálculo" }).map((question) => question.id)).toEqual([2, 1]);
    expect(listQuestionsFiltered({ thematicArea: "Cálculo" }).map((question) => question.id)).toEqual([3]);
  });
});

describe("bulk question updates", () => {
  it("applies one thematic area to every selected question without changing other fields", () => {
    addQuestion(1, 1, "Primeira", "A", "2026-01-01");
    addQuestion(2, 1, "Segunda", "B", "2026-01-02");

    expect(updateQuestionsThematicArea([1, 2], " Área comum ")).toBe(2);
    expect(db.prepare("SELECT id, statement, thematic_area FROM questions ORDER BY id").all()).toEqual([
      { id: 1, statement: "Primeira", thematic_area: "Área comum" },
      { id: 2, statement: "Segunda", thematic_area: "Área comum" },
    ]);
  });

  it("can clear the shared thematic area and rejects partial invalid selections", () => {
    addQuestion(1, 1, "Primeira", "A", "2026-01-01");
    addQuestion(2, 1, "Segunda", "B", "2026-01-02");

    expect(() => updateQuestionsThematicArea([1, 999], "X")).toThrow(/não existem/);
    expect(updateQuestionsThematicArea([1, 2], "  ")).toBe(2);
    expect(db.prepare("SELECT id, thematic_area FROM questions ORDER BY id").all()).toEqual([
      { id: 1, thematic_area: null },
      { id: 2, thematic_area: null },
    ]);
  });

  it("changes only statement and thematic area", () => {
    addQuestion(1, 1, "Original", "Antiga", "2026-01-01");
    db.prepare("UPDATE questions SET options = ?, correct_index = ?, difficulty = ?, audited = ?, rejected = ?, explanation = ?, question_type = ? WHERE id = 1")
      .run('["A","B"]', 1, "hard", 1, 1, "Preservar", "verdadeiro_falso");

    expect(updateQuestionsStatementAndThematicArea([{ id: 1, statement: " Novo enunciado ", thematicArea: " Nova área " }])).toBe(1);
    expect(db.prepare("SELECT statement, thematic_area, options, correct_index, difficulty, audited, rejected, explanation, question_type FROM questions WHERE id = 1").get()).toEqual({
      statement: "Novo enunciado", thematic_area: "Nova área", options: '["A","B"]', correct_index: 1, difficulty: "hard", audited: 1, rejected: 1, explanation: "Preservar", question_type: "verdadeiro_falso",
    });
  });

  it("stores an empty thematic area as NULL", () => {
    addQuestion(1, 1, "Original", "Antiga", "2026-01-01");

    updateQuestionsStatementAndThematicArea([{ id: 1, statement: "Atualizada", thematicArea: "  " }]);

    expect(db.prepare("SELECT statement, thematic_area FROM questions WHERE id = 1").get()).toEqual({
      statement: "Atualizada",
      thematic_area: null,
    });
  });

  it("rolls back every update when any row fails", () => {
    addQuestion(1, 1, "Primeira", "A", "2026-01-01");
    addQuestion(2, 1, "Segunda", "B", "2026-01-01");

    expect(() => updateQuestionsStatementAndThematicArea([
      { id: 1, statement: "Alterada", thematicArea: "X" },
      { id: 2, statement: "explode", thematicArea: "Y" },
    ])).toThrow();
    expect(db.prepare("SELECT id, statement, thematic_area FROM questions ORDER BY id").all()).toEqual([
      { id: 1, statement: "Primeira", thematic_area: "A" },
      { id: 2, statement: "Segunda", thematic_area: "B" },
    ]);
  });

  it("rejects duplicate or missing ids before making a partial change", () => {
    addQuestion(1, 1, "Primeira", "A", "2026-01-01");
    expect(() => updateQuestionsStatementAndThematicArea([{ id: 1, statement: "X" }, { id: 1, statement: "Y" }])).toThrow(/mais de uma vez/);
    expect(() => updateQuestionsStatementAndThematicArea([{ id: 999, statement: "X" }])).toThrow(/não existem/);
    expect(db.prepare("SELECT statement FROM questions WHERE id = 1").get()).toEqual({ statement: "Primeira" });
  });
});

describe("question navigation", () => {
  it("uses created_at DESC, id DESC and never crosses disciplines", () => {
    addQuestion(5, 1, "Mais recente", null, "2026-02-01");
    addQuestion(4, 1, "Mesmo instante", null, "2026-02-01");
    addQuestion(3, 1, "Mais antiga", null, "2026-01-01");
    addQuestion(99, 2, "Outra disciplina", null, "2026-03-01");

    expect(getQuestionNavigation(4, 1)).toEqual({ previousId: 5, nextId: 3 });
    expect(getQuestionNavigation(5, 1)).toEqual({ nextId: 4 });
    expect(getQuestionNavigation(3, 1)).toEqual({ previousId: 4 });
  });
});
