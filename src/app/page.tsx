export const dynamic = "force-dynamic";
import Link from "next/link";
import { getStats } from "@/lib/db/stats";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";

export default function Dashboard() {
  const stats = getStats();
  const recent = listQuestionsFiltered({ audited: false }).slice(0, 5);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div className="actions-row">
          <Link href="/questions/new" className="btn btn-primary">+ Nova Questão</Link>
          <Link href="/ai" className="btn btn-ghost">Gerar com IA</Link>
          <Link href="/exams" className="btn btn-ghost">Montar Prova</Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.disciplines}</div>
          <div className="stat-label">Disciplinas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.questionsTotal}</div>
          <div className="stat-label">Questões</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--warning)" }}>{stats.questionsDraft}</div>
          <div className="stat-label">Aguardando Auditoria</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>{stats.questionsAudited}</div>
          <div className="stat-label">Auditadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.exams}</div>
          <div className="stat-label">Provas</div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
            Questões Aguardando Auditoria
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th>Enunciado</th>
                <th>Dificuldade</th>
                <th>Fonte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((q) => (
                <tr key={q.id}>
                  <td style={{ maxWidth: 400 }}>{q.statement.slice(0, 100)}{q.statement.length > 100 ? "…" : ""}</td>
                  <td>{q.difficulty}</td>
                  <td><span className={`badge ${q.source === "ai" ? "badge-ai" : ""}`}>{q.source}</span></td>
                  <td><Link href={`/questions/${q.id}`} className="btn btn-sm btn-ghost">Auditar →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.questionsDraft > 5 && (
            <div style={{ marginTop: "0.75rem" }}>
              <Link href="/audit" className="btn btn-ghost btn-sm">Ver todas ({stats.questionsDraft})</Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
