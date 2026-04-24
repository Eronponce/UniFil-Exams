"use client";

import { useState, useActionState } from "react";
import Image from "next/image";
import type { Question, QuestionType } from "@/types";
import type { QuestionFormState } from "@/lib/actions/questions";

interface Discipline { id: number; name: string }

const LETTERS = ["A", "B", "C", "D", "E"];
const DIFFICULTIES = [
  { value: "easy", label: "Fácil" },
  { value: "medium", label: "Médio" },
  { value: "hard", label: "Difícil" },
];
const TYPES = [
  { value: "objetiva", label: "Objetiva (múltipla escolha)" },
  { value: "verdadeiro_falso", label: "Verdadeiro ou Falso" },
  { value: "dissertativa", label: "Dissertativa" },
];

interface Props {
  disciplines: Discipline[];
  action: (prev: QuestionFormState | undefined, formData: FormData) => Promise<QuestionFormState | undefined>;
  question?: Question;
  cancelHref: string;
  title: string;
  submitLabel?: string;
}

export function QuestionForm({ disciplines, action, question, cancelHref, title, submitLabel = "Salvar Questão" }: Props) {
  const [questionType, setQuestionType] = useState<QuestionType>(question?.questionType ?? "objetiva");
  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <a href={cancelHref} className="btn btn-ghost">← Voltar</a>
      </div>
      <div className="card" style={{ maxWidth: 700 }}>
        <form action={formAction}>
          {question && <input type="hidden" name="id" value={question.id} />}
          <input type="hidden" name="source" value="manual" />

          {state?.error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#991b1b" }}>
              {state.error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="disciplineId">Disciplina *</label>
              <select id="disciplineId" name="disciplineId" className="form-select" defaultValue={question?.disciplineId ?? ""} required>
                <option value="">Selecione…</option>
                {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="difficulty">Dificuldade</label>
              <select id="difficulty" name="difficulty" className="form-select" defaultValue={question?.difficulty ?? "medium"}>
                {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="questionType">Tipo de Questão</label>
            <select
              id="questionType"
              name="questionType"
              className="form-select"
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as QuestionType)}
            >
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="statement">Enunciado *</label>
            <textarea id="statement" name="statement" className="form-textarea" rows={4} defaultValue={question?.statement ?? ""} required />
          </div>

          {questionType === "objetiva" && (
            <div className="form-group">
              <label className="form-label">Alternativas *</label>
              <div className="options-list">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="option-row">
                    <div className="option-letter">{LETTERS[i]}</div>
                    <input
                      name={`option${i}`}
                      className="form-input"
                      placeholder={`Alternativa ${LETTERS[i]}`}
                      defaultValue={question?.options[i]?.text ?? ""}
                      required
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                      <input type="radio" name="correctIndex" value={i} defaultChecked={i === (question?.correctIndex ?? 0)} required />
                      Correta
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {questionType === "verdadeiro_falso" && (
            <div className="form-group">
              <label className="form-label">Resposta Correta</label>
              <div style={{ display: "flex", gap: "1.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input type="radio" name="correctIndex" value={0} defaultChecked={(question?.correctIndex ?? 0) === 0} required />
                  <span style={{ fontWeight: 600, color: "#16a34a" }}>Verdadeiro</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input type="radio" name="correctIndex" value={1} defaultChecked={question?.correctIndex === 1} required />
                  <span style={{ fontWeight: 600, color: "#dc2626" }}>Falso</span>
                </label>
              </div>
            </div>
          )}

          {questionType === "dissertativa" && (
            <div className="form-group">
              <label className="form-label" htmlFor="answerLines">Linhas em branco no PDF para resposta</label>
              <input
                id="answerLines"
                name="answerLines"
                type="number"
                className="form-input"
                style={{ maxWidth: 120 }}
                min={0}
                max={30}
                defaultValue={question?.answerLines ?? 5}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="thematicArea">Área Temática</label>
            <input id="thematicArea" name="thematicArea" className="form-input" defaultValue={question?.thematicArea ?? ""} placeholder="Ex: Herança, Polimorfismo, Normalização…" />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="explanation">Justificativa da resposta{questionType === "dissertativa" ? " / gabarito esperado" : ""}</label>
            <textarea id="explanation" name="explanation" className="form-textarea" rows={3} defaultValue={question?.explanation ?? ""} placeholder={questionType === "dissertativa" ? "Descreva o que se espera como resposta correta…" : "Explique por que a alternativa correta é a correta…"} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="image">Imagem{question?.imageUrl ? " (substituir)" : " (opcional)"}</label>
            {question?.imageUrl && (
              <div style={{ marginBottom: "0.5rem" }}>
                <Image src={question.imageUrl} alt="Atual" width={200} height={140} style={{ borderRadius: 4, border: "1px solid var(--border)" }} />
              </div>
            )}
            <input id="image" name="image" type="file" accept="image/*" className="form-input" style={{ padding: "0.4rem" }} />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Salvando…" : submitLabel}</button>
            <a href={cancelHref} className="btn btn-ghost">Cancelar</a>
          </div>
        </form>
      </div>
    </>
  );
}
