import { getDb } from "./client";

export interface Stats {
  disciplines: number;
  questionsDraft: number;
  questionsAudited: number;
  questionsTotal: number;
  exams: number;
}

export interface DisciplineReadiness {
  id: number;
  name: string;
  code: string;
  total: number;
  pending: number;
  audited: number;
}

export interface DashboardStats extends Stats {
  auditRate: number;
  disciplineReadiness: DisciplineReadiness[];
}

export function getStats(): Stats {
  const db = getDb();
  const disciplines = (db.prepare("SELECT COUNT(*) as n FROM disciplines WHERE active=1").get() as { n: number }).n;
  const questionsDraft = (db.prepare("SELECT COUNT(*) as n FROM questions WHERE audited=0").get() as { n: number }).n;
  const questionsAudited = (db.prepare("SELECT COUNT(*) as n FROM questions WHERE audited=1").get() as { n: number }).n;
  const exams = (db.prepare("SELECT COUNT(*) as n FROM exams").get() as { n: number }).n;
  return { disciplines, questionsDraft, questionsAudited, questionsTotal: questionsDraft + questionsAudited, exams };
}

/** Read-only aggregate used by the command-center dashboard. */
export function getDashboardStats(): DashboardStats {
  const stats = getStats();
  const rows = getDb()
    .prepare(
      `SELECT d.id, d.name, d.code,
              COUNT(q.id) AS total,
              COALESCE(SUM(CASE WHEN q.audited = 0 THEN 1 ELSE 0 END), 0) AS pending,
              COALESCE(SUM(CASE WHEN q.audited = 1 THEN 1 ELSE 0 END), 0) AS audited
       FROM disciplines d
       LEFT JOIN questions q ON q.discipline_id = d.id AND q.rejected = 0
       WHERE d.active = 1
       GROUP BY d.id
       ORDER BY pending DESC, d.name
       LIMIT 8`
    )
    .all() as DisciplineReadiness[];

  return {
    ...stats,
    auditRate: stats.questionsTotal === 0 ? 0 : Math.round((stats.questionsAudited / stats.questionsTotal) * 100),
    disciplineReadiness: rows,
  };
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
