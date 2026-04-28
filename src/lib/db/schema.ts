import { getDb } from "./client";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS disciplines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  code        TEXT    NOT NULL UNIQUE,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  discipline_id INTEGER NOT NULL REFERENCES disciplines(id),
  statement     TEXT    NOT NULL,
  options       TEXT    NOT NULL,
  correct_index INTEGER NOT NULL CHECK(correct_index BETWEEN 0 AND 4),
  image_path    TEXT,
  difficulty    TEXT    NOT NULL DEFAULT 'medium'
                        CHECK(difficulty IN ('easy','medium','hard')),
  source        TEXT    NOT NULL DEFAULT 'manual'
                        CHECK(source IN ('manual','ai')),
  audited       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exams (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  discipline_id INTEGER NOT NULL REFERENCES disciplines(id),
  title         TEXT    NOT NULL,
  answer_key_width_pt INTEGER NOT NULL DEFAULT 350,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  position    INTEGER NOT NULL,
  PRIMARY KEY (exam_id, question_id)
);

CREATE TABLE IF NOT EXISTS exam_sets (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id            INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  label              TEXT    NOT NULL,
  evalbee_image_path TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exam_set_questions (
  set_id                INTEGER NOT NULL REFERENCES exam_sets(id) ON DELETE CASCADE,
  question_id           INTEGER NOT NULL REFERENCES questions(id),
  position              INTEGER NOT NULL,
  shuffled_options      TEXT    NOT NULL,
  correct_shuffled_index INTEGER NOT NULL,
  PRIMARY KEY (set_id, question_id)
);
`;

export function migrate(): void {
  const db = getDb();
  db.exec(SCHEMA);
  // Column migrations added post-initial schema
  const qCols = (db.prepare("PRAGMA table_info(questions)").all() as { name: string }[]).map((c) => c.name);
  if (!qCols.includes("thematic_area")) db.exec("ALTER TABLE questions ADD COLUMN thematic_area TEXT");
  if (!qCols.includes("explanation")) db.exec("ALTER TABLE questions ADD COLUMN explanation TEXT NOT NULL DEFAULT ''");
  if (!qCols.includes("question_type")) db.exec("ALTER TABLE questions ADD COLUMN question_type TEXT NOT NULL DEFAULT 'objetiva'");
  if (!qCols.includes("answer_lines")) db.exec("ALTER TABLE questions ADD COLUMN answer_lines INTEGER NOT NULL DEFAULT 0");
  if (!qCols.includes("rejected")) db.exec("ALTER TABLE questions ADD COLUMN rejected INTEGER NOT NULL DEFAULT 0");
  const eCols = (db.prepare("PRAGMA table_info(exams)").all() as { name: string }[]).map((c) => c.name);
  if (!eCols.includes("institution")) db.exec("ALTER TABLE exams ADD COLUMN institution TEXT NOT NULL DEFAULT 'UniFil - Centro Universitário Filadélfia'");
  if (!eCols.includes("answer_key_width_pt")) db.exec("ALTER TABLE exams ADD COLUMN answer_key_width_pt INTEGER NOT NULL DEFAULT 350");
}
