"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { batchGenerateAction, type BatchState } from "@/lib/actions/ai-batch";
import { batchSaveQuestionsAction } from "@/lib/actions/questions";
import type { BatchGeneratedQuestion } from "@/lib/ai/batch-prompt";

interface Discipline { id: number; name: string }

const DIFF_LABEL: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const DIFF_COLOR: Record<string, string> = { easy: "#bbf7d0", medium: "#fef08a", hard: "#fecaca" };

export function ImportClient({ disciplines }: { disciplines: Discipline[] }) {
  const [batchState, setBatchState] = useState<BatchState>({});
  const [step, setStep] = useState<"input" | "preview" | "done">("input");
  const [questions, setQuestions] = useState<BatchGeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [saveError, setSaveError] = useState<string>();
  const [generating, startGenerate] = useTransition();
  const [saving, startSaving] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startGenerate(async () => {
      const result = await batchGenerateAction({}, formData);
      setBatchState(result);
      if (result.results?.length) {
        setQuestions(result.results);
        setSelected(new Set(result.results.map((_, i) => i)));
        setStep("preview");
      }
    });
  }

  function updateArea(i: number, value: string) {
    setQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, thematicArea: value } : q));
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
    // Explicitly map to the expected shape so no fields are silently dropped by serialization
    const toSave = questions
      .filter((_, i) => selected.has(i))
      .map((q) => ({
        statement: q.statement,
        options: q.options,
        correctIndex: q.correctIndex,
        difficulty: q.difficulty,
        thematicArea: q.thematicArea ?? undefined,
        explanation: q.explanation ?? "",
      }));
    setSaveError(undefined);
    startSaving(async () => {
      const result = await batchSaveQuestionsAction(toSave, batchState.disciplineId!);
      if (result.error) setSaveError(result.error);
      else { setSavedCount(result.count); setStep("done"); }
    });
  }

  function resetToInput() {
    setBatchState({}); setQuestions([]); setStep("input");
    setSavedCount(0); setSaveError(undefined); setSelected(new Set());
  }

  if (step === "done") {
    return (
      <>
        <div className="page-header"><h1 className="page-title">Importação Concluída</h1></div>
        <div className="card" style={{ maxWidth: 480, textAlign: "center", padding: "2rem" }}>
          <p style={{ fontSize: "3rem", margin: "0 0 0.5rem" }}>✓</p>
          <p style={{ fontSize: "1.1rem", marginBottom: "1.5rem" }}>
            <strong>{savedCount}</strong> questão{savedCount !== 1 ? "ões" : ""} salva{savedCount !== 1 ? "s" : ""} com sucesso!
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <Link href="/questions" className="btn btn-primary">Ver Banco de Questões</Link>
            <button className="btn btn-ghost" onClick={resetToInput}>Importar mais</button>
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
          <h1 className="page-title">Revisar Questões ({questions.length} identificadas)</h1>
          <button className="btn btn-ghost" onClick={resetToInput}>← Voltar</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
            Selecionar todas ({selected.size}/{questions.length})
          </label>
          <button className="btn btn-primary" disabled={selected.size === 0 || saving} onClick={handleSave}>
            {saving ? "Salvando..." : `Salvar selecionadas (${selected.size})`}
          </button>
          {saveError && <span style={{ color: "#dc2626" }}>{saveError}</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {questions.map((q, i) => (
            <div key={i} className="card" style={{ padding: "1rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <input type="checkbox" checked={selected.has(i)} onChange={(e) => toggleOne(i, e.target.checked)} style={{ marginTop: "0.25rem", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{i + 1}. {q.statement}</p>
                  <ol type="A" style={{ margin: 0, paddingLeft: "1.5rem", marginBottom: "0.5rem" }}>
                    {q.options.map((opt, oi) => (
                      <li key={oi} style={{ color: oi === q.correctIndex ? "#16a34a" : "inherit", fontWeight: oi === q.correctIndex ? 600 : 400, marginBottom: "0.15rem" }}>
                        {opt}
                      </li>
                    ))}
                  </ol>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: 99, background: DIFF_COLOR[q.difficulty ?? "medium"] ?? "#f3f4f6" }}>
                      {DIFF_LABEL[q.difficulty ?? "medium"]}
                    </span>
                    <input
                      value={q.thematicArea ?? ""}
                      onChange={(e) => updateArea(i, e.target.value)}
                      placeholder="Área temática (edite se quiser)"
                      style={{ fontSize: "0.78rem", padding: "0.15rem 0.5rem", border: "1px solid #d1d5db", borderRadius: 4, flex: 1, minWidth: 160 }}
                    />
                  </div>
                  {q.explanation && <p style={{ fontSize: "0.78rem", opacity: 0.65, marginTop: "0.4rem", fontStyle: "italic" }}>{q.explanation}</p>}
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
      <div className="page-header"><h1 className="page-title">Importar Questões via IA</h1></div>
      <div className="card" style={{ maxWidth: 700 }}>
        <p style={{ marginBottom: "1.5rem", opacity: 0.75, fontSize: "0.9rem" }}>
          Cole o texto com as questões. A IA identifica cada uma, gera 5 alternativas, classifica a dificuldade e sugere a área temática automaticamente.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Disciplina *</label>
              <select name="disciplineId" className="form-select" required>
                {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Provedor IA</label>
              <select name="provider" className="form-select">
                <option value="ollama">Ollama (local)</option>
                <option value="claude">Claude</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Texto com as questões *</label>
            <textarea name="rawText" className="form-textarea" rows={12} required
              placeholder={"Cole aqui as questões em texto. Exemplo:\n\n1. O que é herança em POO?\n\n2. Diferença entre classe abstrata e interface\n\n3. Explique polimorfismo..."} />
          </div>

          {batchState.error && <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{batchState.error}</p>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={generating}>
              {generating ? "Analisando com IA..." : "Analisar e Gerar Questões"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
