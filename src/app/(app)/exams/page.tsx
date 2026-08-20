export const dynamic = "force-dynamic";

import Link from "next/link";
import { listDisciplines } from "@/lib/db/disciplines";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { normalizeThematicAreas } from "@/lib/questions/thematic-areas";
import { ExamDisciplineFilter } from "./_components/exam-discipline-filter";
import { VisualExamBuilder } from "./_components/visual-exam-builder";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/ui";

interface ExamsSearchParams {
  discipline?: string;
  area?: string | string[];
  error?: string;
  title?: string;
  institution?: string;
  instructions?: string;
  quantitySets?: string;
  allowQuestionSplit?: string;
  draftSeed?: string;
}

function makeDraftSeed(disciplineId: number | undefined, questionIds: readonly number[]): string {
  return `visual-${disciplineId ?? "none"}-${questionIds.join("-") || "empty"}`;
}

export default async function ExamsPage({ searchParams }: { searchParams: Promise<ExamsSearchParams> }) {
  const sp = await searchParams;
  const disciplines = listDisciplines();
  const selectedDisciplineId = sp.discipline ? Number(sp.discipline) : undefined;
  const selectedDisciplineName = selectedDisciplineId
    ? disciplines.find((discipline) => discipline.id === selectedDisciplineId)?.name
    : undefined;
  const selectedAreas = normalizeThematicAreas(sp.area);
  const auditedQuestions = selectedDisciplineId
    ? listQuestionsFiltered({ audited: true, disciplineId: selectedDisciplineId, thematicAreas: selectedAreas })
    : [];
  const allAreasForDiscipline = selectedDisciplineId
    ? [...new Set(
        listQuestionsFiltered({ audited: true, disciplineId: selectedDisciplineId })
          .map((question) => question.thematicArea)
          .filter(Boolean) as string[],
      )].sort()
    : [];
  const draftSeed = sp.draftSeed ?? makeDraftSeed(selectedDisciplineId, auditedQuestions.map((question) => question.id));

  return (
    <>
      <PageHeader
        eyebrow="Avaliações · Criar"
        title="Montagem de prova"
        description="Selecione questões auditadas, organize cada largura e confira o formato A4 enquanto edita."
        actions={<Link href="/audit" className="btn btn-ghost"><Icon name="circle-check" size={15} /> Revisar banco</Link>}
      />

      <div className="exam-builder-filter-card card">
        <ExamDisciplineFilter disciplines={disciplines} areas={allAreasForDiscipline} selectedAreas={selectedAreas} />
        <div className="exam-builder-history-link">
          Provas já criadas ficam em <Link href="/exports">Exportações e histórico →</Link>.
        </div>
      </div>

      {!selectedDisciplineId ? (
        <div className="card visual-exam-empty-state">
          Selecione uma disciplina acima para carregar as questões auditadas no editor visual.
        </div>
      ) : auditedQuestions.length === 0 ? (
        <div className="card visual-exam-empty-state">
          Nenhuma questão auditada{selectedAreas.length ? " nas áreas selecionadas" : ""}. <Link href="/audit">Audite questões</Link> ou <Link href="/questions/new">crie uma questão</Link>.
        </div>
      ) : (
        <VisualExamBuilder
          key={JSON.stringify({ discipline: selectedDisciplineId, areas: [...selectedAreas].sort(), ids: auditedQuestions.map((question) => question.id) })}
          disciplineId={selectedDisciplineId}
          disciplineName={selectedDisciplineName}
          areas={selectedAreas}
          questions={auditedQuestions}
          initialTitle={sp.title ?? ""}
          initialInstitution={sp.institution ?? "UniFil - Centro Universitário Filadélfia"}
          initialInstructions={sp.instructions ?? "Leia atentamente cada questão e assinale apenas uma alternativa quando aplicável."}
          initialQuantitySets={sp.quantitySets ?? "2"}
          initialAllowQuestionSplit={sp.allowQuestionSplit ?? ""}
          initialDraftSeed={draftSeed}
          error={sp.error && sp.error !== "campos-obrigatorios" ? decodeURIComponent(sp.error) : undefined}
        />
      )}
    </>
  );
}
