export const dynamic = "force-dynamic";
import Link from "next/link";
import { listDisciplines } from "@/lib/db/disciplines";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { normalizeThematicAreas } from "@/lib/questions/thematic-areas";
import { QuestionFilters } from "./_components/question-filters";
import { QuestionsTable } from "./_components/questions-table";
import type { QuestionType } from "@/types";
import { EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ discipline?: string; audited?: string; rejected?: string; q?: string; type?: string; area?: string | string[]; withoutArea?: string }> }) {
  const sp = await searchParams;
  const disciplines = listDisciplines();
  const disciplineId = sp.discipline ? Number(sp.discipline) : undefined;
  const thematicAreas = normalizeThematicAreas(sp.area);

  const questions = listQuestionsFiltered({
    disciplineId,
    rejected: sp.rejected === "1" ? true : undefined,
    audited: sp.rejected === "1" ? undefined : (sp.audited === "1" ? true : sp.audited === "0" ? false : undefined),
    search: sp.q,
    questionType: (sp.type ?? undefined) as QuestionType | undefined,
    thematicAreas,
    withoutThematicArea: sp.withoutArea === "1",
  });

  // Available areas scoped to selected discipline (ignores other filters)
  const allAreas = [...new Set(
    listQuestionsFiltered({ disciplineId })
      .map((q) => q.thematicArea)
      .filter(Boolean) as string[]
  )].sort();
  const hasFilters = Boolean(sp.discipline || sp.audited || sp.rejected || sp.q || sp.type || thematicAreas.length > 0 || sp.withoutArea === "1");

  // Build export query params from current filters
  const exportParams = new URLSearchParams();
  if (sp.discipline) exportParams.set("discipline", sp.discipline);
  if (sp.audited) exportParams.set("audited", sp.audited);
  if (sp.rejected) exportParams.set("rejected", sp.rejected);
  if (sp.q) exportParams.set("q", sp.q);
  if (sp.type) exportParams.set("type", sp.type);
  for (const area of thematicAreas) exportParams.append("area", area);
  if (sp.withoutArea === "1") exportParams.set("withoutArea", "1");
  const exportBase = `/api/export/questions?${exportParams.toString()}`;

  return (
    <>
      <PageHeader eyebrow="Organizar · Conteúdo" title="Banco de questões" description="Pesquise, filtre e reutilize um acervo confiável para suas próximas avaliações." actions={<>
        <Link href="/questions/importar" className="btn btn-ghost"><Icon name="upload" size={15} /> Importar</Link>
        <a href={`${exportBase}&format=json`} download className="btn btn-ghost">↓ JSON</a>
        <a href={`${exportBase}&format=csv`} download className="btn btn-ghost">↓ CSV</a>
        <Link href="/questions/new" className="btn btn-primary"><Icon name="plus" size={15} /> Nova questão</Link>
      </>} />

      <QuestionFilters disciplines={disciplines} areas={allAreas} />

      {questions.length === 0 ? (
        <EmptyState title="Nenhuma questão encontrada" description={hasFilters ? "Tente remover algum filtro ou crie uma nova questão para este banco." : "Crie a primeira questão para começar seu acervo reutilizável."} action={<Link href={hasFilters ? "/questions" : "/questions/new"} className="btn btn-primary">{hasFilters ? "Limpar filtros" : "Criar questão"}</Link>} icon="layers" />
      ) : (
        <QuestionsTable questions={questions} />
      )}
      <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--muted)" }}>{questions.length} questão(ões)</p>
    </>
  );
}
