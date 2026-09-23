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
  answerKeyWidthPt?: string;
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
        eyebrow="Provas"
        title="Montar prova"
        description="Escolha as questões, ajuste as quantidades por tipo e confira a folha A4 ao vivo."
        actions={(
          <div className="actions-row">
            <Link href="/audit" className="btn btn-ghost"><Icon name="circle-check" size={15} /> Revisar banco</Link>
            <Link href="/exports" className="btn btn-ghost"><Icon name="file-text" size={15} /> Provas criadas</Link>
          </div>
        )}
      />

      {!selectedDisciplineId || auditedQuestions.length === 0 ? (
        <>
          <div className="exam-builder-filter-card card">
            <ExamDisciplineFilter disciplines={disciplines} areas={allAreasForDiscipline} selectedAreas={selectedAreas} />
          </div>
          <div className="card visual-exam-empty-state">
            {!selectedDisciplineId ? (
              <>Selecione uma disciplina para carregar as questões auditadas.</>
            ) : (
              <>Nenhuma questão auditada{selectedAreas.length ? " nas áreas selecionadas" : ""}. <Link href="/audit">Audite questões</Link> ou <Link href="/questions/new">crie uma questão</Link>.</>
            )}
          </div>
        </>
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
          initialAnswerKeyWidthPt={Number(sp.answerKeyWidthPt)}
          initialDraftSeed={draftSeed}
          filter={<ExamDisciplineFilter key="exam-filter" compact disciplines={disciplines} areas={allAreasForDiscipline} selectedAreas={selectedAreas} />}
          error={sp.error && sp.error !== "campos-obrigatorios" ? decodeURIComponent(sp.error) : undefined}
        />
      )}
    </>
  );
}
