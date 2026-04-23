"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { QuestionExportFileSchema, parseCsvQuestions, type ExportedQuestion } from "@/lib/importexport/types";
import { importQuestionsFromJsonAction } from "@/lib/actions/import";

interface Discipline { id: number; name: string }

const TYPE_LABEL: Record<string, string> = { objetiva: "Objetiva", verdadeiro_falso: "V/F", dissertativa: "Dissertativa" };
const TYPE_COLOR: Record<string, string> = { objetiva: "#dbeafe", verdadeiro_falso: "#fef9c3", dissertativa: "#f3e8ff" };
const DIFF_LABEL: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const DIFF_COLOR: Record<string, string> = { easy: "#bbf7d0", medium: "#fef08a", hard: "#fecaca" };

export function ImportFileClient({ disciplines }: { disciplines: Discipline[] }) {
  const [step, setStep] = useState<"input" | "preview" | "done">("input");
  const [questions, setQuestions] = useState<ExportedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [disciplineId, setDisciplineId] = useState<number>(disciplines[0]?.id ?? 0);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();

  function handleFileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("questionFile") as File | null;
    const selDiscipline = Number(fd.get("disciplineId"));
    if (!file || !selDiscipline) return;
    setDisciplineId(selDiscipline);
    setError(undefined);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        let qs: ExportedQuestion[];
        if (file.name.toLowerCase().endsWith(".json")) {
          qs = QuestionExportFileSchema.parse(JSON.parse(text)).questions;
        } else {
          qs = parseCsvQuestions(text);
          if (!qs.length) throw new Error("Nenhuma questão encontrada no CSV.");
        }
        setQuestions(qs);
        setSelected(new Set(qs.map((_, i) => i)));
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao ler arquivo.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(questions.map((_, i) => i)) : new Set());
  }

  function toggleOne(i: number, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(i); else next.delete(i);
    setSelected(next);
  }

  function handleSave() {
    const toSave = questions.filter((_, i) => selected.has(i));
    setError(undefined);
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), questions: toSave });
    startSaving(async () => {
      const result = await importQuestionsFromJsonAction(payload, disciplineId);
      if (result.errors.length) setError(result.errors[0]);
      else { setSavedCount(result.count); setStep("done"); }
    });
  }

  function reset() {
    setStep("input"); setQuestions([]); setSelected(new Set());
    setSavedCount(0); setError(undefined);
  }

  if (step === "done") {
    return (
      <>
        <div className="page-header"><h1 className="page-title">Importação Concluída</h1></div>
        <div className="card" style={{ maxWidth: 480, textAlign: "center", padding: "2rem" }}>
          <p style={{ fontSize: "3rem", margin: "0 0 0.5rem" }}>✓</p>
          <p style={{ fontSize: "1.1rem", marginBottom: "1.5rem" }}>
            <strong>{savedCount}</strong> questão{savedCount !== 1 ? "ões" : ""} importada{savedCount !== 1 ? "s" : ""} com sucesso!
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <Link href="/questions" className="btn btn-primary">Ver Banco de Questões</Link>
            <button className="btn btn-ghost" onClick={reset}>Importar mais</button>
          </div>
        </div>
      </>
    );
  }

  if (step === "preview") {
    const allSelected = selected.size === questions.length;
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Revisar Questões ({questions.length} encontradas)</h1>
          <button className="btn btn-ghost" onClick={reset}>← Voltar</button>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label className="form-label">Salvar na disciplina:</label>
          <select
            className="form-select"
            style={{ maxWidth: 280 }}
            value={disciplineId}
            onChange={(e) => setDisciplineId(Number(e.target.value))}
          >
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
            Selecionar todas ({selected.size}/{questions.length})
          </label>
          <button className="btn btn-primary" disabled={selected.size === 0 || saving} onClick={handleSave}>
            {saving ? "Salvando..." : `Importar selecionadas (${selected.size})`}
          </button>
          {error && <span style={{ color: "#dc2626" }}>{error}</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {questions.map((q, i) => (
            <div key={i} className="card" style={{ padding: "1rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <input type="checkbox" checked={selected.has(i)} onChange={(e) => toggleOne(i, e.target.checked)} style={{ marginTop: "0.25rem", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{i + 1}. {q.statement}</p>
                  {q.questionType === "objetiva" && q.options.length > 0 && (
                    <ol type="A" style={{ margin: 0, paddingLeft: "1.5rem", marginBottom: "0.5rem" }}>
                      {q.options.map((opt, oi) => (
                        <li key={oi} style={{ color: oi === q.correctIndex ? "#16a34a" : "inherit", fontWeight: oi === q.correctIndex ? 600 : 400, marginBottom: "0.15rem" }}>
                          {opt}
                        </li>
                      ))}
                    </ol>
                  )}
                  {q.questionType === "verdadeiro_falso" && (
                    <p style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                      Correto: <strong style={{ color: "#16a34a" }}>{q.correctIndex === 0 ? "Verdadeiro" : "Falso"}</strong>
                    </p>
                  )}
                  {q.questionType === "dissertativa" && (
                    <p style={{ marginBottom: "0.5rem", fontSize: "0.85rem", opacity: 0.7 }}>{q.answerLines} linha{q.answerLines !== 1 ? "s" : ""} em branco no PDF</p>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: 99, background: TYPE_COLOR[q.questionType ?? "objetiva"] }}>
                      {TYPE_LABEL[q.questionType ?? "objetiva"]}
                    </span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: 99, background: DIFF_COLOR[q.difficulty ?? "medium"] }}>
                      {DIFF_LABEL[q.difficulty ?? "medium"]}
                    </span>
                    {q.thematicArea && <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>{q.thematicArea}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Importar Questões</h1>
        <Link href="/questions" className="btn btn-ghost">← Voltar</Link>
      </div>
      <div className="card" style={{ maxWidth: 600 }}>
        <p style={{ marginBottom: "1.5rem", opacity: 0.75, fontSize: "0.9rem" }}>
          Importe questões a partir de um arquivo <strong>.json</strong> (exportado por este sistema) ou <strong>.csv</strong> (colunas: statement, question_type, difficulty, option_a…e, correct_index, thematic_area, answer_lines).
        </p>
        <form onSubmit={handleFileSubmit}>
          <div className="form-group">
            <label className="form-label">Disciplina de destino *</label>
            <select name="disciplineId" className="form-select" required defaultValue={disciplines[0]?.id}>
              {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Arquivo (.json ou .csv) *</label>
            <input name="questionFile" type="file" accept=".json,.csv" className="form-input" style={{ padding: "0.4rem" }} required />
          </div>
          {error && <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Carregar e Visualizar</button>
          </div>
        </form>
      </div>
    </>
  );
}
