"use client";

import { useState, useEffect, useMemo } from "react";
import { useWorkspaceStore } from "@/lib/state/workspace-store";
import { truncateRichTextPlain } from "@/lib/html/rich-text";
import { RichText } from "@/components/rich-text";
import type { QuestionOption } from "@/types";

const TYPE_ORDER: Record<string, number> = { objetiva: 0, verdadeiro_falso: 1, numerica: 2, dissertativa: 3 };
const TYPE_LABEL: Record<string, string> = { objetiva: "Objetiva", verdadeiro_falso: "V/F", numerica: "Numérica", dissertativa: "Dissertativa" };
const TYPE_BG: Record<string, string> = { objetiva: "#dbeafe", verdadeiro_falso: "#fef9c3", numerica: "#dcfce7", dissertativa: "#f3e8ff" };
const LETTERS = ["A", "B", "C", "D", "E"];
const DIFF_LABEL: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const DIFF_COLOR: Record<string, string> = { easy: "#bbf7d0", medium: "#fef08a", hard: "#fecaca" };

export interface AuditedQuestion {
  id: number;
  questionType: string;
  statement: string;
  difficulty: string;
  thematicArea?: string | null;
  correctIndex: number;
  answerLines?: number;
  correctAnswer?: string;
  imageUrl?: string | null;
  options?: QuestionOption[];
}

interface Props {
  questions: AuditedQuestion[];
  areas?: string[];
}

export function AuditedQuestionsSelector({ questions, areas = [] }: Props) {
  const { setSelectedTypeCounts } = useWorkspaceStore();

  const sorted = useMemo(
    () =>
      [...questions].sort((a, b) => {
        const td = (TYPE_ORDER[a.questionType] ?? 99) - (TYPE_ORDER[b.questionType] ?? 99);
        if (td !== 0) return td;
        return truncateRichTextPlain(a.statement, 200).localeCompare(
          truncateRichTextPlain(b.statement, 200),
          "pt-BR",
        );
      }),
    [questions],
  );

  const selectionKey = JSON.stringify({
    areas: areas.map((area) => area.trim()).filter(Boolean).sort(),
    questionIds: sorted.map((question) => question.id),
  });
  const allQuestionIds = useMemo(() => new Set(sorted.map((question) => question.id)), [sorted]);
  const [selection, setSelection] = useState(() => ({ key: selectionKey, ids: new Set(sorted.map((q) => q.id)) }));

  // A changed filtered pool deliberately starts fully selected by policy. The
  // parent gives this component a pool key, so a changed area set mounts a
  // fresh selection instead of restoring an old manual deselection.
  const selectedIds = useMemo(
    () => selection.key === selectionKey ? selection.ids : allQuestionIds,
    [allQuestionIds, selection, selectionKey],
  );

  useEffect(() => {
    const counts = { objetiva: 0, verdadeiro_falso: 0, dissertativa: 0, numerica: 0 };
    for (const q of sorted) {
      if (selectedIds.has(q.id)) {
        const k = q.questionType as keyof typeof counts;
        if (k in counts) counts[k]++;
      }
    }
    setSelectedTypeCounts(counts);
    return () => { setSelectedTypeCounts(null); };
  }, [selectedIds, setSelectedTypeCounts, sorted]);

  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection({ key: selectionKey, ids: next });
  };

  return (
    <div className="form-group">
      <label className="form-label">
        Questões auditadas — {questions.length} disponíveis{areas.length ? ` (${areas.length} área(s) selecionada(s))` : ""} · {selectedIds.size} selecionadas
      </label>
      <div className="exam-question-selector-list">
        {sorted.map((q) => (
          <label
            key={q.id}
            className="exam-question-selector-card"
          >
            <input
              type="checkbox"
              name="questionIds"
              value={q.id}
              checked={selectedIds.has(q.id)}
              onChange={() => toggle(q.id)}
              aria-label={`Selecionar questão ${q.id}`}
              className="exam-question-selector-checkbox"
            />
            <span className="exam-question-selector-content">
              <span className="exam-question-selector-heading">
                <strong>Questão {q.id}</strong>
                <span className="exam-question-selector-badges">
                  <span className="exam-question-selector-badge" style={{ background: TYPE_BG[q.questionType] ?? "#f3f4f6" }}>
                  {TYPE_LABEL[q.questionType] ?? q.questionType}
                  </span>
                  <span className="exam-question-selector-badge" style={{ background: DIFF_COLOR[q.difficulty] ?? "#f3f4f6" }}>
                  {DIFF_LABEL[q.difficulty]}
                  </span>
                  {q.thematicArea && (
                    <span className="exam-question-selector-badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>
                    {q.thematicArea}
                    </span>
                  )}
                </span>
              </span>
              <div className="exam-question-selector-statement">
                <RichText html={q.statement} />
              </div>
              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.imageUrl} alt="" className="exam-question-selector-image" />
              )}
              {q.questionType === "objetiva" && q.options && (
                <div className="exam-question-selector-options">
                  {q.options.map((option, index) => (
                    <span key={option.index} className="exam-question-selector-option">
                      <strong>{LETTERS[index] ?? "?"})</strong> {option.text}
                    </span>
                  ))}
                </div>
              )}
              <span className="exam-question-selector-detail">
                {q.questionType === "verdadeiro_falso"
                  ? "Resposta: Verdadeiro ou Falso"
                  : q.questionType === "numerica"
                    ? `Resposta numérica: ${q.correctAnswer || "não informada"}`
                    : q.questionType === "dissertativa"
                      ? `${q.answerLines ?? 0} linha(s) de resposta`
                      : "Cinco alternativas"}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
