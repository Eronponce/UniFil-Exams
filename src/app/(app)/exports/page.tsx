export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getExam, getExamVersion, hasExamVersions, listExamVersions, listExams } from "@/lib/db/exams";
import { listDisciplines } from "@/lib/db/disciplines";
import { getQuestion } from "@/lib/db/questions";
import type { Question } from "@/types";
import { GabaritoUpload, LogoUpload } from "./upload-panel";
import { RichText } from "@/components/rich-text";
import { EmptyState, PageHeader } from "@/components/ui";
import { getExamQuestionIdsInSetAOrder, getExamReferenceSet, getQuestionOptionsInSetOrder } from "@/lib/exam/reference-set";
import type { ExamVersionSnapshotQuestion } from "@/lib/exam/version";

const LETTERS = ["A", "B", "C", "D", "E"];
const DIFF_LABEL: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const DIFF_COLOR: Record<string, string> = { easy: "#bbf7d0", medium: "#fef08a", hard: "#fecaca" };

interface ExportQuestion {
  id: number;
  disciplineId: number;
  statement: string;
  imageUrl: string | null;
  options: Question["options"];
  correctIndex: number;
  difficulty: Question["difficulty"];
  thematicArea: string | null;
  explanation: string;
  questionType: Question["questionType"];
  answerLines: number;
  correctAnswer: string;
}

function quickAnswer(sq: { shuffledOptions: number[]; correctShuffledIndex: number }, q: ExportQuestion | undefined): string {
  if (!q) return "?";
  if (q.questionType === "dissertativa") return "-";
  if (q.questionType === "numerica") return q.correctAnswer || "-";
  if (q.questionType === "verdadeiro_falso") return (sq.shuffledOptions[sq.correctShuffledIndex] === 0) ? "True" : "False";
  return LETTERS[sq.correctShuffledIndex] ?? "?";
}

function snapshotQuestionToExport(question: ExamVersionSnapshotQuestion, disciplineId: number): ExportQuestion {
  return {
    id: question.sourceQuestionId,
    disciplineId,
    statement: question.statementHtml,
    imageUrl: question.imageUrl,
    options: question.options,
    correctIndex: question.correctIndex,
    difficulty: question.difficulty,
    thematicArea: question.thematicArea,
    explanation: question.explanation,
    questionType: question.questionType,
    answerLines: question.answerLines,
    correctAnswer: question.correctAnswer,
  };
}

function optionsInSetOrder(question: ExportQuestion, setQuestion: { shuffledOptions: number[] } | undefined) {
  const byIndex = new Map(question.options.map((option) => [option.index, option]));
  const indices = setQuestion?.shuffledOptions?.length === question.options.length
    ? setQuestion.shuffledOptions
    : question.options.map((option) => option.index);
  return indices.map((originalIndex, position) => ({
    originalIndex,
    letter: String.fromCharCode(65 + position),
    text: byIndex.get(originalIndex)?.text ?? "",
    isCorrect: originalIndex === question.correctIndex,
  }));
}

export default async function ExportsPage({ searchParams }: { searchParams: Promise<{ exam?: string; new?: string; version?: string }> }) {
  const sp = await searchParams;
  const exams = listExams("ativas");
  const disciplines = listDisciplines();
  const discMap = Object.fromEntries(disciplines.map((d) => [d.id, d.name]));

  const explicitExam = sp.exam ? getExam(Number(sp.exam)) : undefined;
  if (sp.exam && !explicitExam) notFound();
  const selectedExam = explicitExam ?? exams[0];
  const isNew = sp.new === "1";

  const versions = selectedExam ? listExamVersions(selectedExam.id) : [];
  const hasStoredVersions = selectedExam ? hasExamVersions(selectedExam.id) : false;
  let selectedVersion = selectedExam ? getExamVersion(selectedExam.id) : undefined;
  if (sp.version !== undefined) {
    const versionNumber = /^\d+$/.test(sp.version) ? Number(sp.version) : NaN;
    selectedVersion = Number.isSafeInteger(versionNumber) && versionNumber > 0
      ? getExamVersion(selectedExam?.id ?? 0, versionNumber)
      : undefined;
  }
  if ((sp.version !== undefined && (!selectedExam || !selectedVersion)) || (sp.version === undefined && hasStoredVersions && !selectedVersion)) notFound();
  const sidebarExams = selectedExam && !selectedExam.active
    ? [selectedExam, ...exams.filter((exam) => exam.id !== selectedExam.id)]
    : exams;
  const displayTitle = selectedVersion?.snapshot.title ?? selectedExam?.title ?? "";
  const displayInstitution = selectedVersion?.snapshot.institution ?? selectedExam?.institution ?? "";
  const displayAnswerKeyWidth = selectedVersion?.snapshot.answerKeyWidthPt ?? selectedExam?.answerKeyWidthPt ?? 350;
  const displaySets = selectedVersion
    ? selectedVersion.snapshot.sets.map((set) => ({
        id: set.sourceSetId,
        examId: selectedExam?.id ?? 0,
        label: set.label,
        evalBeeImageUrl: set.evalBeeImageUrl,
        createdAt: "",
        questions: set.questions.map((question) => ({
          questionId: question.sourceQuestionId,
          position: question.position,
          shuffledOptions: question.shuffledOptions,
          correctShuffledIndex: question.correctShuffledIndex,
        })),
      }))
    : (selectedExam?.sets ?? []);

  const selectedExamQuestionIds = selectedExam
    ? getExamQuestionIdsInSetAOrder(displaySets)
    : [];
  const snapshotQuestionMap = new Map(
    selectedVersion?.snapshot.sets.flatMap((set) => set.questions.map((question) => [
      question.sourceQuestionId,
      snapshotQuestionToExport(question, selectedExam?.disciplineId ?? 0),
    ] as const)) ?? [],
  );
  const selectedExamQuestions: ExportQuestion[] = selectedVersion
    ? selectedExamQuestionIds.map((id) => snapshotQuestionMap.get(id)).filter((q): q is ExportQuestion => q != null)
    : selectedExamQuestionIds.map((id) => getQuestion(id)).filter((q): q is NonNullable<typeof q> => q != null);
  const qMap = Object.fromEntries(selectedExamQuestions.map((q) => [q.id, q]));
  const referenceSet = selectedExam ? getExamReferenceSet(displaySets) : undefined;
  const referenceSetLabel = referenceSet?.label ?? "A";
  const referenceQuestionMap = new Map(referenceSet?.questions.map((question) => [question.questionId, question]) ?? []);
  const referenceOptionsMap = new Map(selectedExamQuestions.map((question) => [
    question.id,
    selectedVersion
      ? optionsInSetOrder(question, referenceQuestionMap.get(question.id))
      : getQuestionOptionsInSetOrder(question as Question, referenceQuestionMap.get(question.id)),
  ]));
  const csvVersionQuery = selectedVersion ? `?version=${selectedVersion.versionNumber}` : "";

  return (
    <>
      <PageHeader eyebrow="Avaliações · Entregar" title="Exportações" description="Confira cada conjunto e gere o preview A4, PDF direto, CSV de gabarito ou ZIP." actions={<Link href="/exams" className="btn btn-ghost">← Montar prova</Link>} />

      {!selectedExam ? (
        <EmptyState title="Nenhuma avaliação criada" description="Monte uma prova para liberar os arquivos de entrega." action={<Link href="/exams" className="btn btn-primary">Montar prova</Link>} icon="file-text" />
      ) : (
        <>
          <div className="exports-layout">
            {/* Sidebar */}
            <div>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.5rem" }}>Provas</p>
              {sidebarExams.map((e) => (
                <Link
                  key={e.id}
                  href={`/exports?exam=${e.id}`}
                  className="btn btn-ghost"
                  style={{ display: "block", marginBottom: "0.4rem", textAlign: "left", background: selectedExam?.id === e.id ? "#f3f4f6" : "transparent" }}
                >
                  {e.title}{!e.active ? " · inativa" : ""}
                </Link>
              ))}

              <div style={{ marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Logo do PDF</p>
                <LogoUpload />
              </div>
            </div>

            {/* Per-exam: PDF + CSV + gabarito upload */}
            {selectedExam && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                  <h2 style={{ fontWeight: 700, margin: 0 }}>{displayTitle}</h2>
                  {!selectedExam.active && <span className="badge badge-warning">Prova inativa · acesso preservado</span>}
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  {discMap[selectedExam.disciplineId]} · {displayInstitution}
                </p>
                <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
                  {displaySets.length} set(s) · {displaySets[0]?.questions.length ?? 0} questões por set
                  {selectedVersion ? ` · versão ${selectedVersion.versionNumber}` : ""}
                </p>

                <GabaritoUpload key={selectedExam.id} examId={selectedExam.id} answerKeyWidthPt={displayAnswerKeyWidth} isNew={isNew} />

                <div className="card" style={{ marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Histórico de versões</h3>
                      <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>A versão mais recente é usada por padrão; versões antigas continuam imprimíveis.</p>
                    </div>
                    <Link href={`/exams/${selectedExam.id}/edit`} className="btn btn-ghost btn-sm">Editar prova</Link>
                  </div>
                  {versions.length > 0 ? (
                    <form method="get" className="actions-row" style={{ marginTop: "0.85rem" }}>
                      <input type="hidden" name="exam" value={selectedExam.id} />
                      <label className="form-label" htmlFor="exports-version" style={{ margin: 0 }}>Versão</label>
                      <select id="exports-version" name="version" className="form-select" defaultValue={selectedVersion?.versionNumber ?? versions[0]?.versionNumber}>
                        {versions.map((version) => (
                          <option key={version.id} value={version.versionNumber}>
                            Versão {version.versionNumber}{version.changeNote ? ` · ${version.changeNote}` : ""}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn btn-ghost btn-sm">Abrir versão</button>
                    </form>
                  ) : (
                    <p style={{ marginTop: "0.85rem", fontSize: "0.78rem", color: "var(--muted)" }}>Prova legada sem versões; a primeira edição criará um baseline e uma nova versão.</p>
                  )}
                </div>

                <div className="card" style={{ marginBottom: "1.25rem" }}>
                  <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Prova em HTML A4</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>
                    Todos os sets ({displaySets.map((s) => `Set ${s.label}`).join(", ")}) em página fake A4, com preview na mesma aba e PDF direto gerado do mesmo HTML.
                  </p>
                  <div className="actions-row">
                    <Link href={`/print/exam/${selectedExam.id}${selectedVersion ? `?version=${selectedVersion.versionNumber}` : ""}`} className="btn btn-primary">
                      ⬇ Abrir Preview
                    </Link>
                    <a href={`/api/pdf/exam/${selectedExam.id}${selectedVersion ? `?version=${selectedVersion.versionNumber}` : ""}`} className="btn btn-ghost">
                      PDF direto
                    </a>
                    <a href={`/api/zip/exam/${selectedExam.id}`} className="btn btn-ghost" download>
                      ⬇ ZIP (1 PDF por set)
                    </a>
                  </div>
                </div>

                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                    <h3 style={{ fontWeight: 600, margin: 0 }}>Gabarito Rápido por Set (CSV)</h3>
                    <div className="actions-row">
                      <a href={`/api/csv/exam/${selectedExam.id}${csvVersionQuery}`} className="btn btn-ghost btn-sm" download>⬇ Todos os Sets</a>
                      <a href={`/api/csv/exam/${selectedExam.id}/trace${csvVersionQuery}`} className="btn btn-ghost btn-sm" download>↔ Mapa de rastreabilidade</a>
                    </div>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.9rem" }}>
                    Cruze a versão + número da questão do EvalBee com o ID no banco.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {displaySets.map((set) => (
                      <div key={set.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>Set {set.label}</strong>
                          <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginLeft: "0.5rem" }}>
                            {[...set.questions].sort((a, b) => a.position - b.position).map((sq, i) =>
                              `Q${i + 1}→${quickAnswer(sq, qMap[sq.questionId])}`
                            ).join("  ")}
                          </span>
                        </div>
                        <div className="actions-row">
                          <a href={`/api/pdf/commented/${set.id}${csvVersionQuery}`} className="btn btn-primary btn-sm" download>⬇ PDF comentado</a>
                          <a href={`/api/csv/${set.id}${csvVersionQuery}`} className="btn btn-ghost btn-sm" download>⬇ CSV</a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gabarito Completo */}
          {selectedExamQuestions.length > 0 && selectedExam && (
            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>
                Gabarito Completo · Ordem do Set {referenceSetLabel}
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
                {selectedExamQuestions.length} questão(ões) na sequência e com as alternativas exatamente como aparecem no Set {referenceSetLabel}.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {selectedExamQuestions.map((q, idx) => (
                  <div key={q.id} style={{ paddingBottom: "1.5rem", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                      <span style={{ fontWeight: 700, color: "var(--muted)", minWidth: 28, fontSize: "0.9rem" }}>{idx + 1}.</span>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            marginBottom: "0.5rem",
                            padding: "0.75rem 0.85rem",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "#fcfcfd",
                            overflowX: "auto",
                            fontSize: "0.95rem",
                            lineHeight: 1.6,
                            color: "var(--text)",
                            fontWeight: 400,
                          }}
                        >
                          <RichText html={q.statement} />
                        </div>

                        {q.imageUrl && (
                          <div style={{ marginBottom: "0.65rem" }}>
                            <Image
                              src={q.imageUrl}
                              alt={`Imagem da questão ${idx + 1}`}
                              width={720}
                              height={480}
                              style={{
                                display: "block",
                                width: "100%",
                                maxWidth: 560,
                                height: "auto",
                                borderRadius: 8,
                                border: "1px solid #d1d5db",
                                background: "#fff",
                              }}
                            />
                          </div>
                        )}

                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: 99, background: q.questionType === "objetiva" ? "#dbeafe" : q.questionType === "verdadeiro_falso" ? "#fef9c3" : q.questionType === "numerica" ? "#dcfce7" : "#f3e8ff" }}>
                            {q.questionType === "objetiva" ? "Objetiva" : q.questionType === "verdadeiro_falso" ? "V ou F" : q.questionType === "numerica" ? "Numérica" : "Dissertativa"}
                          </span>
                          <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: 99, background: DIFF_COLOR[q.difficulty] ?? "#f3f4f6" }}>
                            {DIFF_LABEL[q.difficulty]}
                          </span>
                          {q.thematicArea && (
                            <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: 99, background: "#e0e7ff", color: "#3730a3" }}>
                              {q.thematicArea}
                            </span>
                          )}
                          <span style={{ fontSize: "0.7rem", color: "#888" }}>{discMap[q.disciplineId]}</span>
                        </div>
                      </div>
                    </div>

                    {/* Options / answer by type */}
                    {q.questionType === "objetiva" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginLeft: 28, marginBottom: "0.75rem" }}>
                        {(referenceOptionsMap.get(q.id) ?? []).map((option) => {
                          const isCorrect = option.isCorrect;
                          return (
                            <div key={option.originalIndex} style={{ display: "flex", gap: "0.4rem", padding: "0.25rem 0.5rem", borderRadius: 4, background: isCorrect ? "#dcfce7" : "transparent" }}>
                              <span style={{ fontWeight: 700, minWidth: 20, color: isCorrect ? "#15803d" : "var(--muted)", fontSize: "0.85rem" }}>{option.letter})</span>
                              <span style={{ fontSize: "0.875rem", color: isCorrect ? "#15803d" : "inherit", fontWeight: isCorrect ? 600 : 400 }}>
                                {option.text}{isCorrect && <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem" }}>✓</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.questionType === "verdadeiro_falso" && (
                      <div style={{ display: "flex", gap: "1rem", marginLeft: 28, marginBottom: "0.75rem" }}>
                        {["Verdadeiro", "Falso"].map((label, i) => {
                          const isCorrect = i === q.correctIndex;
                          return (
                            <div key={i} style={{ display: "flex", gap: "0.4rem", padding: "0.25rem 0.5rem", borderRadius: 4, background: isCorrect ? "#dcfce7" : "transparent" }}>
                              <span style={{ fontWeight: 700, color: isCorrect ? "#15803d" : "var(--muted)", fontSize: "0.85rem" }}>{i === 0 ? "V" : "F"})</span>
                              <span style={{ fontSize: "0.875rem", color: isCorrect ? "#15803d" : "inherit", fontWeight: isCorrect ? 600 : 400 }}>
                                {label}{isCorrect && <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem" }}>✓</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.questionType === "numerica" && (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginLeft: 28, marginBottom: "0.75rem" }}>
                        <span style={{ fontSize: "0.85rem", opacity: 0.65 }}>Resposta:</span>
                        <span style={{ fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "0.2rem 0.6rem", borderRadius: 4, fontSize: "0.95rem" }}>
                          {q.correctAnswer || "—"}
                        </span>
                      </div>
                    )}

                    {q.questionType === "dissertativa" && (
                      <p style={{ marginLeft: 28, marginBottom: "0.75rem", fontSize: "0.85rem", opacity: 0.65 }}>
                        Questão dissertativa · {q.answerLines} linha{q.answerLines !== 1 ? "s" : ""} em branco no PDF
                      </p>
                    )}

                    {q.explanation && (
                      <div style={{ marginLeft: 28, fontSize: "0.825rem", color: "#1e40af", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "0.4rem 0.7rem" }}>
                        <strong>{q.questionType === "dissertativa" || q.questionType === "numerica" ? "Gabarito esperado:" : "Justificativa:"}</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

    </>
  );
}
