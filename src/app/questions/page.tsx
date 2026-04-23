import Link from "next/link";
import { listDisciplines } from "@/lib/db/disciplines";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";

const LETTERS = ["A", "B", "C", "D", "E"];

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ discipline?: string; audited?: string; q?: string }> }) {
  const sp = await searchParams;
  const disciplines = listDisciplines();
  const questions = listQuestionsFiltered({
    disciplineId: sp.discipline ? Number(sp.discipline) : undefined,
    audited: sp.audited === "1" ? true : sp.audited === "0" ? false : undefined,
    search: sp.q,
  });

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Banco de Questões</h1>
        <Link href="/questions/new" className="btn btn-primary">+ Nova Questão</Link>
      </div>

      <form className="filter-bar" method="GET">
        <select name="discipline" className="form-select" defaultValue={sp.discipline ?? ""}>
          <option value="">Todas as disciplinas</option>
          {disciplines.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select name="audited" className="form-select" defaultValue={sp.audited ?? ""}>
          <option value="">Todos os status</option>
          <option value="0">Rascunho</option>
          <option value="1">Auditada</option>
        </select>
        <input name="q" className="form-input" placeholder="Buscar enunciado…" defaultValue={sp.q ?? ""} />
        <button type="submit" className="btn btn-ghost">Filtrar</button>
        {(sp.discipline || sp.audited || sp.q) && (
          <Link href="/questions" className="btn btn-ghost">Limpar</Link>
        )}
      </form>

      {questions.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
          Nenhuma questão encontrada.
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Enunciado</th>
              <th>Correta</th>
              <th>Dificuldade</th>
              <th>Status</th>
              <th>Fonte</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id}>
                <td style={{ maxWidth: 360 }}>
                  <Link href={`/questions/${q.id}`}>{q.statement.slice(0, 90)}{q.statement.length > 90 ? "…" : ""}</Link>
                </td>
                <td>{LETTERS[q.correctIndex]}</td>
                <td>{q.difficulty}</td>
                <td>
                  <span className={`badge ${q.audited ? "badge-audited" : "badge-draft"}`}>
                    {q.audited ? "Auditada" : "Rascunho"}
                  </span>
                </td>
                <td>
                  <span className={q.source === "ai" ? "badge badge-ai" : ""}>{q.source}</span>
                </td>
                <td>
                  <div className="actions-row">
                    <Link href={`/questions/${q.id}`} className="btn btn-sm btn-ghost">Ver</Link>
                    <Link href={`/questions/${q.id}/edit`} className="btn btn-sm btn-ghost">Editar</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--muted)" }}>{questions.length} questão(ões)</p>
    </>
  );
}
