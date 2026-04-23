export const dynamic = "force-dynamic";
import Link from "next/link";
import { listDisciplines } from "@/lib/db/disciplines";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { QuestionFilters } from "./_components/question-filters";
import type { QuestionType } from "@/types";

const LETTERS = ["A", "B", "C", "D", "E"];

function correctLabel(type: QuestionType, idx: number): string {
  if (type === "dissertativa") return "—";
  if (type === "verdadeiro_falso") return idx === 0 ? "V" : "F";
  return LETTERS[idx] ?? "?";
}

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ discipline?: string; audited?: string; q?: string; type?: string }> }) {
  const sp = await searchParams;
  const disciplines = listDisciplines();
  const questions = listQuestionsFiltered({
    disciplineId: sp.discipline ? Number(sp.discipline) : undefined,
    audited: sp.audited === "1" ? true : sp.audited === "0" ? false : undefined,
    search: sp.q,
    questionType: (sp.type ?? undefined) as QuestionType | undefined,
  });

  // Build export query params from current filters
  const exportParams = new URLSearchParams();
  if (sp.discipline) exportParams.set("discipline", sp.discipline);
  if (sp.audited) exportParams.set("audited", sp.audited);
  if (sp.type) exportParams.set("type", sp.type);
  const exportBase = `/api/export/questions?${exportParams.toString()}`;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Banco de Questões</h1>
        <div className="actions-row">
          <Link href="/questions/importar" className="btn btn-ghost">↑ Importar</Link>
          <a href={`${exportBase}&format=json`} download className="btn btn-ghost">↓ JSON</a>
          <a href={`${exportBase}&format=csv`} download className="btn btn-ghost">↓ CSV</a>
          <Link href="/questions/new" className="btn btn-primary">+ Nova Questão</Link>
        </div>
      </div>

      <QuestionFilters disciplines={disciplines} />

      {questions.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
          Nenhuma questão encontrada.
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Enunciado</th>
              <th>Tipo</th>
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
                <td style={{ maxWidth: 340 }}>
                  <Link href={`/questions/${q.id}`}>{q.statement.slice(0, 80)}{q.statement.length > 80 ? "…" : ""}</Link>
                </td>
                <td>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: 99, background: q.questionType === "objetiva" ? "#dbeafe" : q.questionType === "verdadeiro_falso" ? "#fef9c3" : "#f3e8ff" }}>
                    {q.questionType === "objetiva" ? "Obj" : q.questionType === "verdadeiro_falso" ? "V/F" : "Diss"}
                  </span>
                </td>
                <td>{correctLabel(q.questionType, q.correctIndex)}</td>
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
