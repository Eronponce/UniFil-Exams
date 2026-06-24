"use client";

import { useState, useEffect, useMemo } from "react";
import { useWorkspaceStore } from "@/lib/state/workspace-store";
import { truncateRichTextPlain } from "@/lib/html/rich-text";

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
}

interface Props {
  questions: AuditedQuestion[];
  area?: string;
}

export function AuditedQuestionsSelector({ questions, area }: Props) {
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

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(sorted.map((q) => q.id)));

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

  const toggle = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="form-group">
      <label className="form-label">
        Questões auditadas — {questions.length} disponíveis{area ? ` (área: ${area})` : ""} · {selectedIds.size} selecionadas
      </label>
      <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, padding: "0.5rem" }}>
        {sorted.map((q) => (
          <label
            key={q.id}
            style={{ display: "flex", gap: "0.5rem", padding: "0.4rem 0.25rem", fontSize: "0.875rem", cursor: "pointer", alignItems: "flex-start", borderBottom: "1px solid #f3f4f6" }}
          >
            <input
              type="checkbox"
              name="questionIds"
              value={q.id}
              checked={selectedIds.has(q.id)}
              onChange={() => toggle(q.id)}
              style={{ marginTop: "0.15rem", flexShrink: 0 }}
            />
            <span style={{ flex: 1 }}>
              {truncateRichTextPlain(q.statement, 90)}
              <span style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.35rem", borderRadius: 99, background: TYPE_BG[q.questionType] ?? "#f3f4f6" }}>
                  {TYPE_LABEL[q.questionType] ?? q.questionType}
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
                    ? `[${LETTERS[q.correctIndex] ?? "?"}]`
                    : q.questionType === "verdadeiro_falso"
                      ? `[${q.correctIndex === 0 ? "V" : "F"}]`
                      : q.questionType === "numerica"
                        ? `[${q.correctAnswer || "?"}]`
                        : `[${q.answerLines ?? 0} linhas]`}
                </span>
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
