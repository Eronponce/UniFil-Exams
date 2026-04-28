"use client";

import { useState } from "react";
import Link from "next/link";
import type { Question, QuestionType } from "@/types";
import { deleteManyQuestionsAction } from "@/lib/actions/questions";
import { truncateRichTextPlain } from "@/lib/html/rich-text";

const LETTERS = ["A", "B", "C", "D", "E"];

function correctLabel(type: QuestionType, idx: number): string {
  if (type === "dissertativa") return "—";
  if (type === "verdadeiro_falso") return idx === 0 ? "V" : "F";
  return LETTERS[idx] ?? "?";
}

export function QuestionsTable({ questions }: { questions: Question[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const allSelected = questions.length > 0 && selected.size === questions.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(questions.map((q) => q.id)));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={deleteManyQuestionsAction}>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}

      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                title="Selecionar todas"
              />
            </th>
            <th>Enunciado</th>
            <th>Tipo</th>
            <th>Correta</th>
            <th>Dificuldade</th>
            <th>Status</th>
            <th>Fonte</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr
              key={q.id}
              style={selected.has(q.id) ? { background: "var(--accent-subtle, #eff6ff)" } : undefined}
            >
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(q.id)}
                  onChange={() => toggleOne(q.id)}
                />
              </td>
              <td style={{ maxWidth: 340 }}>
                <Link href={`/questions/${q.id}`}>
                  {truncateRichTextPlain(q.statement, 80)}
                </Link>
              </td>
              <td>
                <span style={{
                  fontSize: "0.75rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: 99,
                  background: q.questionType === "objetiva" ? "#dbeafe" : q.questionType === "verdadeiro_falso" ? "#fef9c3" : "#f3e8ff",
                }}>
                  {q.questionType === "objetiva" ? "Obj" : q.questionType === "verdadeiro_falso" ? "V/F" : "Diss"}
                </span>
              </td>
              <td>{correctLabel(q.questionType, q.correctIndex)}</td>
              <td>{q.difficulty}</td>
              <td>
                <span className={`badge ${q.audited ? "badge-audited" : "badge-draft"}`}>
                  {q.audited ? "Auditada" : "Rascunho"}
                </span>
              </td>
              <td>
                <span className={q.source === "ai" ? "badge badge-ai" : ""}>{q.source}</span>
              </td>
              <td>
                <div className="actions-row">
                  <Link href={`/questions/${q.id}`} className="btn btn-sm btn-ghost">Ver</Link>
                  <Link href={`/questions/${q.id}/edit`} className="btn btn-sm btn-ghost">Editar</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected.size > 0 && (
        <div style={{
          position: "sticky",
          bottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          background: "var(--card-bg, #fff)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "0.75rem 1.25rem",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          marginTop: "0.75rem",
        }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 500, flex: 1 }}>
            {selected.size} questão(ões) selecionada(s)
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setSelected(new Set())}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-sm"
            style={{ background: "#dc2626", color: "#fff", border: "none" }}
            onClick={(e) => {
              if (!window.confirm(`Excluir ${selected.size} questão(ões)? Esta ação não pode ser desfeita.`)) {
                e.preventDefault();
              }
            }}
          >
            Excluir selecionadas
          </button>
        </div>
      )}
    </form>
  );
}
