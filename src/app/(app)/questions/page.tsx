export const dynamic = "force-dynamic";
import Link from "next/link";
import { listDisciplines } from "@/lib/db/disciplines";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { QuestionFilters } from "./_components/question-filters";
import { QuestionsTable } from "./_components/questions-table";
import type { QuestionType } from "@/types";

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ discipline?: string; audited?: string; rejected?: string; q?: string; type?: string }> }) {
  const sp = await searchParams;
  const disciplines = listDisciplines();
  const questions = listQuestionsFiltered({
    disciplineId: sp.discipline ? Number(sp.discipline) : undefined,
    rejected: sp.rejected === "1" ? true : undefined,
    audited: sp.rejected === "1" ? undefined : (sp.audited === "1" ? true : sp.audited === "0" ? false : undefined),
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
        <QuestionsTable questions={questions} />
      )}
      <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--muted)" }}>{questions.length} questão(ões)</p>
    </>
  );
}
