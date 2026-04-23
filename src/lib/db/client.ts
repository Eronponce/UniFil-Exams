import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "unifil-exams.db");

function createClient(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

const g = global as typeof globalThis & { _db?: Database.Database };

export function getDb(): Database.Database {
  if (!g._db) g._db = createClient();
  return g._db;
}
