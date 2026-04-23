import { getDb } from "./client";

export interface Stats {
  disciplines: number;
  questionsDraft: number;
  questionsAudited: number;
  questionsTotal: number;
  exams: number;
}

export function getStats(): Stats {
  const db = getDb();
  const disciplines = (db.prepare("SELECT COUNT(*) as n FROM disciplines WHERE active=1").get() as { n: number }).n;
  const questionsDraft = (db.prepare("SELECT COUNT(*) as n FROM questions WHERE audited=0").get() as { n: number }).n;
  const questionsAudited = (db.prepare("SELECT COUNT(*) as n FROM questions WHERE audited=1").get() as { n: number }).n;
  const exams = (db.prepare("SELECT COUNT(*) as n FROM exams").get() as { n: number }).n;
  return { disciplines, questionsDraft, questionsAudited, questionsTotal: questionsDraft + questionsAudited, exams };
}

export interface DisciplineWithCount {
  id: number;
  name: string;
  code: string;
  createdAt: string;
  questionCount: number;
}

export function listDisciplinesWithCount(): DisciplineWithCount[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT d.id, d.name, d.code, d.created_at,
              COUNT(q.id) as question_count
       FROM disciplines d
       LEFT JOIN questions q ON q.discipline_id = d.id
       WHERE d.active = 1
       GROUP BY d.id
       ORDER BY d.name`
    )
    .all() as DisciplineWithCount[];
}
