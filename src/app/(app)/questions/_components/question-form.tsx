"use client";

import { useState, useActionState } from "react";
import Image from "next/image";
import type { Question, QuestionType } from "@/types";
import type { QuestionFormState } from "@/lib/actions/questions";
import { makeQuestionDraft, useWorkspaceStore } from "@/lib/state/workspace-store";
import type { QuestionDraft } from "@/lib/state/workspace-store";
import { MarkdownText } from "@/components/markdown-text";
import {
  RICH_TEXT_ALLOWED_ATTRIBUTE_LABEL,
  RICH_TEXT_ALLOWED_STYLE_LABEL,
  RICH_TEXT_ALLOWED_TAGS_LABEL,
  RICH_TEXT_BLOCKED_FEATURES_LABEL,
} from "@/lib/html/rich-text";

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
  /** When set, form state is persisted to the workspace store under this key. */
  draftKey?: string;
}

export function QuestionForm({ disciplines, action, question, cancelHref, title, submitLabel = "Salvar Questão", draftKey }: Props) {
  const { questionDrafts, updateQuestionDraft, resetQuestionDraft } = useWorkspaceStore();
  const stored = draftKey ? (questionDrafts[draftKey] ?? makeQuestionDraft()) : null;

  function upd(patch: Partial<QuestionDraft>) {
    if (draftKey) updateQuestionDraft(draftKey, patch);
  }

  // questionType: from store when draftKey present, else local state
  const [localType, setLocalType] = useState<QuestionType>(question?.questionType ?? "objetiva");
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const questionType = stored ? stored.questionType : localType;

  const [state, formAction, isPending] = useActionState(action, undefined);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <a href={cancelHref} className="btn btn-ghost">← Voltar</a>
      </div>
      <div className="card">
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
              <select
                id="disciplineId" name="disciplineId" className="form-select" required
                {...(stored
                  ? { value: stored.disciplineId, onChange: (e) => upd({ disciplineId: e.target.value }) }
                  : { defaultValue: question?.disciplineId ?? "" }
                )}
              >
                <option value="">Selecione…</option>
                {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="difficulty">Dificuldade</label>
              <select
                id="difficulty" name="difficulty" className="form-select"
                {...(stored
                  ? { value: stored.difficulty, onChange: (e) => upd({ difficulty: e.target.value as QuestionDraft["difficulty"] }) }
                  : { defaultValue: question?.difficulty ?? "medium" }
                )}
              >
                {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="questionType">Tipo de Questão</label>
            <select
              id="questionType" name="questionType" className="form-select"
              value={questionType}
              onChange={(e) => {
                const t = e.target.value as QuestionType;
                if (stored) upd({ questionType: t }); else setLocalType(t);
              }}
            >
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
              <label className="form-label" htmlFor="statement" style={{ marginBottom: 0 }}>Enunciado *</label>
              <button type="button" onClick={() => setShowHtmlPreview((v) => !v)} style={{ fontSize: "0.75rem", opacity: 0.6, background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}>
                {showHtmlPreview ? "← editar" : "preview HTML"}
              </button>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.4rem" }}>
              Aceita HTML sanitizado no enunciado. Tags: {RICH_TEXT_ALLOWED_TAGS_LABEL}. Atributos: {RICH_TEXT_ALLOWED_ATTRIBUTE_LABEL}. Styles: {RICH_TEXT_ALLOWED_STYLE_LABEL}. {RICH_TEXT_BLOCKED_FEATURES_LABEL}.
            </p>
            {showHtmlPreview ? (
              <div style={{ minHeight: 96, border: "1px solid var(--border)", borderRadius: 6, padding: "0.5rem 0.75rem", background: "#fafafa" }}>
                <MarkdownText text={stored?.statement ?? question?.statement ?? ""} />
              </div>
            ) : (
              <textarea
                id="statement" name="statement" className="form-textarea" rows={4} required
                {...(stored
                  ? { value: stored.statement, onChange: (e) => upd({ statement: e.target.value }) }
                  : { defaultValue: question?.statement ?? "" }
                )}
              />
            )}
          </div>

          {questionType === "objetiva" && (
            <div className="form-group">
              <label className="form-label">Alternativas *</label>
              <div className="options-list">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="option-row">
                    <div className="option-letter">{LETTERS[i]}</div>
                    <input
                      name={`option${i}`} className="form-input"
                      placeholder={`Alternativa ${LETTERS[i]}`}
                      required
                      {...(stored
                        ? {
                            value: stored.options[i] ?? "",
                            onChange: (e) => {
                              const opts = [...stored.options];
                              opts[i] = e.target.value;
                              upd({ options: opts });
                            },
                          }
                        : { defaultValue: question?.options[i]?.text ?? "" }
                      )}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {stored ? (
                        <input
                          type="radio" name="correctIndex" value={i}
                          checked={stored.correctIndex === String(i)}
                          onChange={() => upd({ correctIndex: String(i) })}
                          required
                        />
                      ) : (
                        <input type="radio" name="correctIndex" value={i} defaultChecked={i === (question?.correctIndex ?? 0)} required />
                      )}
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
                {[{ label: "Verdadeiro", value: "0", color: "#16a34a" }, { label: "Falso", value: "1", color: "#dc2626" }].map(({ label, value, color }) => (
                  <label key={value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    {stored ? (
                      <input
                        type="radio" name="correctIndex" value={value}
                        checked={stored.correctIndex === value}
                        onChange={() => upd({ correctIndex: value })}
                        required
                      />
                    ) : (
                      <input type="radio" name="correctIndex" value={value} defaultChecked={(question?.correctIndex ?? 0) === Number(value)} required />
                    )}
                    <span style={{ fontWeight: 600, color }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {questionType === "dissertativa" && (
            <div className="form-group">
              <label className="form-label" htmlFor="answerLines">Linhas em branco no PDF para resposta</label>
              <input
                id="answerLines" name="answerLines" type="number"
                className="form-input" style={{ maxWidth: 120 }} min={0} max={30}
                {...(stored
                  ? { value: stored.answerLines, onChange: (e) => upd({ answerLines: e.target.value }) }
                  : { defaultValue: question?.answerLines ?? 5 }
                )}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="thematicArea">Área Temática</label>
            <input
              id="thematicArea" name="thematicArea" className="form-input"
              placeholder="Ex: Herança, Polimorfismo, Normalização…"
              {...(stored
                ? { value: stored.thematicArea, onChange: (e) => upd({ thematicArea: e.target.value }) }
                : { defaultValue: question?.thematicArea ?? "" }
              )}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="explanation">Justificativa da resposta{questionType === "dissertativa" ? " / gabarito esperado" : ""}</label>
            <textarea
              id="explanation" name="explanation" className="form-textarea" rows={3}
              placeholder={questionType === "dissertativa" ? "Descreva o que se espera como resposta correta…" : "Explique por que a alternativa correta é a correta…"}
              {...(stored
                ? { value: stored.explanation, onChange: (e) => upd({ explanation: e.target.value }) }
                : { defaultValue: question?.explanation ?? "" }
              )}
            />
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
            {stored && (
              <button type="button" className="btn btn-ghost" onClick={() => draftKey && resetQuestionDraft(draftKey)} style={{ marginLeft: "auto", fontSize: "0.8rem", opacity: 0.65 }}>
                Limpar rascunho
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
