export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { listExams } from "@/lib/db/exams";
import { listDisciplines } from "@/lib/db/disciplines";
import { getQuestion } from "@/lib/db/questions";
import type { Question } from "@/types";
import { GabaritoUpload, LogoUpload } from "./upload-panel";
import { RichText } from "@/components/rich-text";

const LETTERS = ["A", "B", "C", "D", "E"];
const DIFF_LABEL: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const DIFF_COLOR: Record<string, string> = { easy: "#bbf7d0", medium: "#fef08a", hard: "#fecaca" };

function quickAnswer(sq: { shuffledOptions: number[]; correctShuffledIndex: number }, q: Question | undefined): string {
  if (!q) return "?";
  if (q.questionType === "dissertativa") return "D";
  if (q.questionType === "verdadeiro_falso") return (sq.shuffledOptions[sq.correctShuffledIndex] === 0) ? "V" : "F";
  return LETTERS[sq.correctShuffledIndex] ?? "?";
}

export default async function ExportsPage({ searchParams }: { searchParams: Promise<{ exam?: string; new?: string }> }) {
  const sp = await searchParams;
  const exams = listExams();
  const disciplines = listDisciplines();
  const discMap = Object.fromEntries(disciplines.map((d) => [d.id, d.name]));

  const selectedExam = sp.exam ? exams.find((e) => e.id === Number(sp.exam)) : exams[0];
  const isNew = sp.new === "1";

  const selectedExamQuestionIds = selectedExam
    ? Array.from(new Set(selectedExam.sets.flatMap((set) => set.questions.map((sq) => sq.questionId))))
    : [];
  const selectedExamQuestions = selectedExamQuestionIds
    .map((id) => getQuestion(id))
    .filter((q): q is NonNullable<typeof q> => q != null);
  const qMap = Object.fromEntries(selectedExamQuestions.map((q) => [q.id, q]));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Exportações</h1>
        <Link href="/exams" className="btn btn-ghost">← Montar Prova</Link>
      </div>

      {exams.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
          Nenhuma prova criada. <Link href="/exams">Montar prova</Link>.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "1.5rem", alignItems: "start", marginBottom: "2rem" }}>
            {/* Sidebar */}
            <div>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.5rem" }}>Provas</p>
              {exams.map((e) => (
                <Link
                  key={e.id}
                  href={`/exports?exam=${e.id}`}
                  className="btn btn-ghost"
                  style={{ display: "block", marginBottom: "0.4rem", textAlign: "left", background: selectedExam?.id === e.id ? "#f3f4f6" : "transparent" }}
                >
                  {e.title}
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
                <h2 style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{selectedExam.title}</h2>
                <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  {discMap[selectedExam.disciplineId]} · {selectedExam.institution}
                </p>
                <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
                  {selectedExam.sets.length} set(s) · {selectedExam.sets[0]?.questions.length ?? 0} questões por set
                </p>

                <GabaritoUpload key={selectedExam.id} examId={selectedExam.id} answerKeyWidthPt={selectedExam.answerKeyWidthPt} isNew={isNew} />

                <div className="card" style={{ marginBottom: "1.25rem" }}>
                  <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Prova em HTML A4</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>
                    Todos os sets ({selectedExam.sets.map((s) => `Set ${s.label}`).join(", ")}) em página fake A4, com preview na mesma aba e PDF direto gerado do mesmo HTML.
                  </p>
                  <div className="actions-row">
                    <Link href={`/print/exam/${selectedExam.id}`} className="btn btn-primary">
                      ⬇ Abrir Preview
                    </Link>
                    <a href={`/api/pdf/exam/${selectedExam.id}`} className="btn btn-ghost">
                      PDF direto
                    </a>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Gabarito Rápido por Set (CSV)</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {selectedExam.sets.map((set) => (
                      <div key={set.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>Set {set.label}</strong>
                          <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginLeft: "0.5rem" }}>
                            {[...set.questions].sort((a, b) => a.position - b.position).map((sq, i) =>
                              `Q${i + 1}→${quickAnswer(sq, qMap[sq.questionId])}`
                            ).join("  ")}
                          </span>
                        </div>
                        <a href={`/api/csv/${set.id}`} className="btn btn-ghost btn-sm" download>⬇ CSV</a>
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
                Gabarito Completo
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
                {selectedExamQuestions.length} questão(ões) únicas da prova selecionada — com alternativas originais, resposta correta e justificativa.
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
                          <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: 99, background: q.questionType === "objetiva" ? "#dbeafe" : q.questionType === "verdadeiro_falso" ? "#fef9c3" : "#f3e8ff" }}>
                            {q.questionType === "objetiva" ? "Objetiva" : q.questionType === "verdadeiro_falso" ? "V ou F" : "Dissertativa"}
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
                        {q.options.map((opt) => {
                          const isCorrect = opt.index === q.correctIndex;
                          return (
                            <div key={opt.index} style={{ display: "flex", gap: "0.4rem", padding: "0.25rem 0.5rem", borderRadius: 4, background: isCorrect ? "#dcfce7" : "transparent" }}>
                              <span style={{ fontWeight: 700, minWidth: 20, color: isCorrect ? "#15803d" : "var(--muted)", fontSize: "0.85rem" }}>{LETTERS[opt.index]})</span>
                              <span style={{ fontSize: "0.875rem", color: isCorrect ? "#15803d" : "inherit", fontWeight: isCorrect ? 600 : 400 }}>
                                {opt.text}{isCorrect && <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem" }}>✓</span>}
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

                    {q.questionType === "dissertativa" && (
                      <p style={{ marginLeft: 28, marginBottom: "0.75rem", fontSize: "0.85rem", opacity: 0.65 }}>
                        Questão dissertativa · {q.answerLines} linha{q.answerLines !== 1 ? "s" : ""} em branco no PDF
                      </p>
                    )}

                    {q.explanation && (
                      <div style={{ marginLeft: 28, fontSize: "0.825rem", color: "#1e40af", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "0.4rem 0.7rem" }}>
                        <strong>{q.questionType === "dissertativa" ? "Gabarito esperado:" : "Justificativa:"}</strong> {q.explanation}
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
