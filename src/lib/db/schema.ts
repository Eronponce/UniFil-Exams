import { getDb } from "./client";
import { DEFAULT_EXAM_INSTRUCTIONS } from "@/lib/exam/instructions";

const SQL_DEFAULT_INSTRUCTIONS = DEFAULT_EXAM_INSTRUCTIONS.replace(/'/g, "''");

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
  institution   TEXT    NOT NULL DEFAULT 'UniFil - Centro Universitário Filadélfia',
  instructions  TEXT    NOT NULL DEFAULT '${SQL_DEFAULT_INSTRUCTIONS}',
  active        INTEGER NOT NULL DEFAULT 1,
  allow_question_split INTEGER NOT NULL DEFAULT 0,
  answer_key_width_pt INTEGER NOT NULL DEFAULT 350,
  layout_objetiva TEXT NOT NULL DEFAULT 'column',
  layout_verdadeiro_falso TEXT NOT NULL DEFAULT 'column',
  layout_numerica TEXT NOT NULL DEFAULT 'column',
  layout_dissertativa TEXT NOT NULL DEFAULT 'full',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  position    INTEGER NOT NULL,
  layout_override TEXT CHECK(layout_override IN ('column', 'full') OR layout_override IS NULL),
  image_scale_percent INTEGER CHECK(image_scale_percent IS NULL OR (typeof(image_scale_percent) = 'integer' AND image_scale_percent BETWEEN 25 AND 99)),
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

CREATE TABLE IF NOT EXISTS exam_versions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id         INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  change_note     TEXT NOT NULL DEFAULT '',
  snapshot_json   TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(exam_id, version_number)
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
  if (!qCols.includes("correct_answer")) db.exec("ALTER TABLE questions ADD COLUMN correct_answer TEXT NOT NULL DEFAULT ''");
  const eCols = (db.prepare("PRAGMA table_info(exams)").all() as { name: string }[]).map((c) => c.name);
  if (!eCols.includes("institution")) db.exec("ALTER TABLE exams ADD COLUMN institution TEXT NOT NULL DEFAULT 'UniFil - Centro Universitário Filadélfia'");
  if (!eCols.includes("instructions")) db.exec(`ALTER TABLE exams ADD COLUMN instructions TEXT NOT NULL DEFAULT '${SQL_DEFAULT_INSTRUCTIONS}'`);
  if (!eCols.includes("active")) db.exec("ALTER TABLE exams ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  if (!eCols.includes("allow_question_split")) db.exec("ALTER TABLE exams ADD COLUMN allow_question_split INTEGER NOT NULL DEFAULT 0");
  if (!eCols.includes("answer_key_width_pt")) db.exec("ALTER TABLE exams ADD COLUMN answer_key_width_pt INTEGER NOT NULL DEFAULT 350");
  if (!eCols.includes("layout_objetiva")) db.exec("ALTER TABLE exams ADD COLUMN layout_objetiva TEXT NOT NULL DEFAULT 'column'");
  if (!eCols.includes("layout_verdadeiro_falso")) db.exec("ALTER TABLE exams ADD COLUMN layout_verdadeiro_falso TEXT NOT NULL DEFAULT 'column'");
  if (!eCols.includes("layout_numerica")) db.exec("ALTER TABLE exams ADD COLUMN layout_numerica TEXT NOT NULL DEFAULT 'column'");
  if (!eCols.includes("layout_dissertativa")) db.exec("ALTER TABLE exams ADD COLUMN layout_dissertativa TEXT NOT NULL DEFAULT 'full'");

  const eqCols = (db.prepare("PRAGMA table_info(exam_questions)").all() as { name: string }[]).map((c) => c.name);
  if (!eqCols.includes("layout_override")) {
    db.exec("ALTER TABLE exam_questions ADD COLUMN layout_override TEXT");
  }
  if (!eqCols.includes("image_scale_percent")) {
    db.exec("ALTER TABLE exam_questions ADD COLUMN image_scale_percent INTEGER CHECK(image_scale_percent IS NULL OR (typeof(image_scale_percent) = 'integer' AND image_scale_percent BETWEEN 25 AND 99))");
  }
}
