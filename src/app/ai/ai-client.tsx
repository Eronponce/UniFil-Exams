"use client";

import { useActionState } from "react";
import type { Discipline } from "@/types";
import { generateQuestionAction, type GenerationState } from "@/lib/actions/ai";
import { createQuestionAction } from "@/lib/actions/questions";

const LETTERS = ["A", "B", "C", "D", "E"];

export function AIClient({ disciplines }: { disciplines: Discipline[] }) {
  const [state, formAction, isPending] = useActionState<GenerationState, FormData>(generateQuestionAction, {});

  return (
    <div style={{ display: "grid", gridTemplateColumns: state.result ? "1fr 1fr" : "1fr", gap: "1.5rem", alignItems: "start" }}>
      <div className="card">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem" }}>Configuração</h2>
        <form action={formAction}>
          <div className="form-group">
            <label className="form-label">Disciplina *</label>
            <select name="disciplineId" className="form-select" required>
              <option value="">Selecione…</option>
              {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Provedor IA</label>
            <select name="provider" className="form-select" defaultValue="ollama">
              <option value="ollama">Qwen local (Ollama)</option>
              <option value="claude">Claude API</option>
              <option value="gemini">Gemini API</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tema / Competência *</label>
            <textarea name="topic" className="form-textarea" rows={3} placeholder="Ex: Complexidade de algoritmos de ordenação" required />
          </div>
          {state.error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#991b1b" }}>
              {state.error}
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={isPending} style={{ opacity: isPending ? 0.7 : 1 }}>
            {isPending ? "Gerando…" : "Gerar Questão"}
          </button>
        </form>
      </div>

      {state.result && (
        <div className="card">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem" }}>Questão Gerada — Revise antes de salvar</h2>
          <form action={createQuestionAction}>
            <input type="hidden" name="disciplineId" value={state.result.disciplineId} />
            <input type="hidden" name="source" value="ai" />
            <input type="hidden" name="explanation" value={state.result.explanation ?? ""} />
            <input type="hidden" name="thematicArea" value={state.result.thematicArea ?? ""} />
            <div className="form-group">
              <label className="form-label">Enunciado</label>
              <textarea name="statement" className="form-textarea" rows={4} defaultValue={state.result.statement} required />
            </div>
            <div className="form-group">
              <label className="form-label">Alternativas</label>
              <div className="options-list">
                {state.result.options.map((opt, i) => (
                  <div key={i} className="option-row">
                    <div className="option-letter">{LETTERS[i]}</div>
                    <input name={`option${i}`} className="form-input" defaultValue={opt} required />
                    <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                      <input type="radio" name="correctIndex" value={i} defaultChecked={i === state.result!.correctIndex} />
                      Correta
                    </label>
                  </div>
                ))}
              </div>
            </div>
            {state.result.explanation && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#166534" }}>
                <strong>Justificativa:</strong> {state.result.explanation}
              </div>
            )}
            {state.result.thematicArea && (
              <div style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
                <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "0.15rem 0.5rem", borderRadius: 99, fontSize: "0.78rem" }}>
                  {state.result.thematicArea}
                </span>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Dificuldade</label>
              <select name="difficulty" className="form-select" defaultValue="medium">
                <option value="easy">Fácil</option>
                <option value="medium">Médio</option>
                <option value="hard">Difícil</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Salvar no Banco</button>
          </form>
        </div>
      )}
    </div>
  );
}
