export const dynamic = "force-dynamic";
import Link from "next/link";
import { listDisciplines } from "@/lib/db/disciplines";
import { ExamDisciplineFilter } from "./_components/exam-discipline-filter";
import { ExamDraftFields } from "./_components/exam-draft-fields";
import { AuditedQuestionsSelector } from "./_components/audited-questions-selector";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { listExams } from "@/lib/db/exams";
import { createExamAction } from "@/lib/actions/exams";


export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ discipline?: string; area?: string; error?: string; title?: string; institution?: string; quantitySets?: string; numObjetivas?: string; numVF?: string; numDissertativas?: string; numNumericas?: string }> }) {
  const sp = await searchParams;
  const disciplines = listDisciplines();
  const exams = listExams();
  const selectedDisciplineId = sp.discipline ? Number(sp.discipline) : undefined;
  const selectedArea = sp.area ?? "";

  const auditedQuestions = selectedDisciplineId
    ? listQuestionsFiltered({ audited: true, disciplineId: selectedDisciplineId, thematicArea: selectedArea || undefined })
    : [];

  const allAreasForDiscipline = selectedDisciplineId
    ? [...new Set(
        listQuestionsFiltered({ audited: true, disciplineId: selectedDisciplineId })
          .map((q) => q.thematicArea)
          .filter(Boolean) as string[]
      )].sort()
    : [];
  const typeCounts = {
    objetiva: auditedQuestions.filter((q) => q.questionType === "objetiva").length,
    verdadeiro_falso: auditedQuestions.filter((q) => q.questionType === "verdadeiro_falso").length,
    dissertativa: auditedQuestions.filter((q) => q.questionType === "dissertativa").length,
    numerica: auditedQuestions.filter((q) => q.questionType === "numerica").length,
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Montagem de Prova</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
        <div className="card">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem" }}>Nova Prova</h2>
          {sp.error && sp.error !== "campos-obrigatorios" && (
            <div style={{ background: "#fee2e2", border: "1px solid #f87171", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.8rem", wordBreak: "break-all" }}>
              Erro: {decodeURIComponent(sp.error)}
            </div>
          )}

          <div style={{ marginBottom: "1.25rem" }}>
            <ExamDisciplineFilter disciplines={disciplines} areas={allAreasForDiscipline} />
          </div>

          <form action={createExamAction}>
            <input type="hidden" name="disciplineId" value={selectedDisciplineId ?? ""} />

            <ExamDraftFields
              initialTitle={sp.title ?? ""}
              initialInstitution={sp.institution ?? ""}
              initialQuantitySets={sp.quantitySets ?? ""}
              initialNumObjetivas={sp.numObjetivas ?? ""}
              initialNumVF={sp.numVF ?? ""}
              initialNumDissertativas={sp.numDissertativas ?? ""}
              initialNumNumericas={sp.numNumericas ?? ""}
              typeCounts={typeCounts}
            />

            {!selectedDisciplineId ? (
              <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem" }}>
                Selecione uma disciplina acima para ver as questões auditadas disponíveis.
              </div>
            ) : auditedQuestions.length === 0 ? (
              <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem" }}>
                Nenhuma questão auditada{selectedArea ? ` na área "${selectedArea}"` : ""}.{" "}
                <Link href="/audit">Auditar questões</Link> ou{" "}
                <Link href="/questions/new">criar questões</Link>.
              </div>
            ) : (
              <AuditedQuestionsSelector questions={auditedQuestions} area={selectedArea || undefined} />
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={!selectedDisciplineId || auditedQuestions.length === 0}>
                Gerar Prova com Randomização
              </button>
            </div>
          </form>
        </div>

        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Provas Existentes</h2>
          {exams.length === 0 ? (
            <div className="card" style={{ color: "var(--muted)", textAlign: "center" }}>Nenhuma prova criada ainda.</div>
          ) : (
            exams.map((exam) => (
              <div key={exam.id} className="card" style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{exam.title}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                  {exam.sets.length} set(s) · {exam.sets[0]?.questions.length ?? 0} questões por set
                </div>
                <Link href={`/exports?exam=${exam.id}`} className="btn btn-sm btn-ghost">Exportar →</Link>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
