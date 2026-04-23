export const dynamic = "force-dynamic";
import Link from "next/link";
import { listDisciplines } from "@/lib/db/disciplines";
import { ExamDisciplineFilter } from "./_components/exam-discipline-filter";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { listExams } from "@/lib/db/exams";
import { createExamAction } from "@/lib/actions/exams";

const LETTERS = ["A", "B", "C", "D", "E"];
const DIFF_LABEL: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const DIFF_COLOR: Record<string, string> = { easy: "#bbf7d0", medium: "#fef08a", hard: "#fecaca" };

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ discipline?: string; area?: string; error?: string }> }) {
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

          {/* Filtro de disciplina + área */}
          <div style={{ marginBottom: "1.25rem" }}>
            <ExamDisciplineFilter disciplines={disciplines} areas={allAreasForDiscipline} />
          </div>

          {/* Formulário de criação (POST) */}
          <form action={createExamAction}>
            <input type="hidden" name="disciplineId" value={selectedDisciplineId ?? ""} />

            <div className="form-group">
              <label className="form-label">Título *</label>
              <input name="title" className="form-input" placeholder="Ex: Prova 1 — POO 2026" required />
            </div>

            <div className="form-group">
              <label className="form-label">Instituição</label>
              <input name="institution" className="form-input" defaultValue="UniFil - Centro Universitário Filadélfia" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Questões por prova</label>
                <input name="numQuestions" type="number" className="form-input" min={1} max={200} placeholder={`Todas (${auditedQuestions.length})`} />
                <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Fallback geral. Se preencher quantidades por tipo abaixo, elas têm prioridade.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Quantidade de Sets</label>
                <input name="quantitySets" type="number" className="form-input" defaultValue={2} min={1} max={8} />
              </div>
            </div>

            <div className="card" style={{ background: "#f8fafc", marginBottom: "1.25rem", padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.9rem" }}>
                <div>
                  <p style={{ fontWeight: 600, marginBottom: "0.2rem" }}>Quantidade por tipo</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    Preencha para montar a prova com composição fixa por categoria. Campo vazio = 0 quando qualquer tipo for usado.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <span className="badge" style={{ background: "#dbeafe" }}>Objetivas disponíveis: {typeCounts.objetiva}</span>
                  <span className="badge" style={{ background: "#fef9c3" }}>V/F disponíveis: {typeCounts.verdadeiro_falso}</span>
                  <span className="badge" style={{ background: "#f3e8ff" }}>Dissertativas disponíveis: {typeCounts.dissertativa}</span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Objetivas</label>
                  <input name="numObjetivas" type="number" className="form-input" min={0} max={typeCounts.objetiva || 0} placeholder="0" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Verdadeiro/Falso</label>
                  <input name="numVF" type="number" className="form-input" min={0} max={typeCounts.verdadeiro_falso || 0} placeholder="0" />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0, marginTop: "1rem" }}>
                <label className="form-label">Dissertativas</label>
                <input name="numDissertativas" type="number" className="form-input" min={0} max={typeCounts.dissertativa || 0} placeholder="0" />
              </div>
            </div>

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
              <div className="form-group">
                <label className="form-label">
                  Questões auditadas — {auditedQuestions.length} disponíveis{selectedArea ? ` (área: ${selectedArea})` : ""}
                </label>
                <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, padding: "0.5rem" }}>
                  {auditedQuestions.map((q) => (
                    <label key={q.id} style={{ display: "flex", gap: "0.5rem", padding: "0.4rem 0.25rem", fontSize: "0.875rem", cursor: "pointer", alignItems: "flex-start", borderBottom: "1px solid #f3f4f6" }}>
                      <input type="checkbox" name="questionIds" value={q.id} defaultChecked style={{ marginTop: "0.15rem", flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>
                        {q.statement.slice(0, 90)}{q.statement.length > 90 ? "…" : ""}
                        <span style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.35rem", borderRadius: 99, background: q.questionType === "objetiva" ? "#dbeafe" : q.questionType === "verdadeiro_falso" ? "#fef9c3" : "#f3e8ff" }}>
                            {q.questionType === "objetiva" ? "Objetiva" : q.questionType === "verdadeiro_falso" ? "V/F" : "Dissertativa"}
                          </span>
                          <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.35rem", borderRadius: 99, background: DIFF_COLOR[q.difficulty] ?? "#f3f4f6" }}>
                            {DIFF_LABEL[q.difficulty]}
                          </span>
                          {q.thematicArea && (
                            <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.35rem", borderRadius: 99, background: "#e0e7ff", color: "#3730a3" }}>
                              {q.thematicArea}
                            </span>
                          )}
                          <span style={{ fontSize: "0.7rem", color: "#888" }}>
                            {q.questionType === "objetiva"
                              ? `[${LETTERS[q.correctIndex]}]`
                              : q.questionType === "verdadeiro_falso"
                                ? `[${q.correctIndex === 0 ? "V" : "F"}]`
                                : `[${q.answerLines} linhas]`}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
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
