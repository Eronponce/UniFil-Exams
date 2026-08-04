"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { Question, QuestionType } from "@/types";
import { batchSetQuestionsThematicAreaAction, batchUpdateQuestionsAction, deleteManyQuestionsAction } from "@/lib/actions/questions";
import { truncateRichTextPlain } from "@/lib/html/rich-text";
import { reconcileSelectedQuestionIds } from "@/lib/questions/selection";

const LETTERS = ["A", "B", "C", "D", "E"];

function correctLabel(type: QuestionType, index: number): string {
  if (type === "dissertativa") return "—";
  if (type === "verdadeiro_falso") return index === 0 ? "V" : "F";
  return LETTERS[index] ?? "?";
}

export function QuestionsTable({ questions }: { questions: Question[] }) {
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [isAreaEditorOpen, setAreaEditorOpen] = useState(false);
  const [isBatchEditorOpen, setBatchEditorOpen] = useState(false);
  const [areaState, areaAction, isAreaPending] = useActionState(batchSetQuestionsThematicAreaAction, undefined);
  const [batchState, batchAction, isBatchPending] = useActionState(batchUpdateQuestionsAction, undefined);
  const visibleIds = useMemo(() => questions.map((question) => question.id), [questions]);
  // Keep the source selection reconciled at render time so stale IDs can
  // never reach delete or bulk-edit forms after filters/data change.
  const selected = reconcileSelectedQuestionIds(selection, visibleIds);

  const allSelected = questions.length > 0 && selected.size === questions.length;
  const selectedQuestions = questions.filter((question) => selected.has(question.id));
  const availableAreas = [...new Set(questions.map((question) => question.thematicArea).filter((area): area is string => Boolean(area)))].sort();

  function toggleAll() {
    setSelection(allSelected ? new Set() : new Set(visibleIds));
  }

  function toggleOne(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  }

  return (
    <div>
      <form id="delete-selected-questions" action={deleteManyQuestionsAction}>
        {[...selected].map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
      </form>

      <div className="table-wrap"><table className="table">
        <thead>
          <tr>
            <th style={{ width: 36 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} title="Selecionar todas" aria-label="Selecionar todas as questões visíveis" /></th>
            <th>Enunciado</th><th>Tipo</th><th>Correta</th><th>Dificuldade</th><th>Status</th><th>Fonte</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((question) => (
            <tr key={question.id} style={selected.has(question.id) ? { background: "var(--accent-subtle, #eff6ff)" } : undefined}>
              <td><input type="checkbox" checked={selected.has(question.id)} onChange={() => toggleOne(question.id)} aria-label={`Selecionar questão ${question.id}`} /></td>
              <td style={{ maxWidth: 340 }}><Link href={`/questions/${question.id}`}>{truncateRichTextPlain(question.statement, 80)}</Link></td>
              <td><span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: 99, background: question.questionType === "objetiva" ? "#dbeafe" : question.questionType === "verdadeiro_falso" ? "#fef9c3" : "#f3e8ff" }}>{question.questionType === "objetiva" ? "Obj" : question.questionType === "verdadeiro_falso" ? "V/F" : question.questionType === "numerica" ? "Num" : "Diss"}</span></td>
              <td>{correctLabel(question.questionType, question.correctIndex)}</td>
              <td>{question.difficulty}</td>
              <td><span className={`badge ${question.audited ? "badge-audited" : "badge-draft"}`}>{question.audited ? "Auditada" : "Rascunho"}</span></td>
              <td><span className={question.source === "ai" ? "badge badge-ai" : ""}>{question.source}</span></td>
              <td><div className="actions-row"><Link href={`/questions/${question.id}`} className="btn btn-sm btn-ghost">Ver</Link><Link href={`/questions/${question.id}/edit`} className="btn btn-sm btn-ghost">Editar</Link></div></td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {selected.size > 0 && (
        <div style={{ position: "sticky", bottom: "1rem", display: "flex", alignItems: "center", gap: "1rem", background: "var(--card-bg, #fff)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem 1.25rem", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 500, flex: 1 }}>{selected.size} questão(ões) selecionada(s)</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setSelection(new Set()); setAreaEditorOpen(false); setBatchEditorOpen(false); }}>Cancelar</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => { setAreaEditorOpen(true); setBatchEditorOpen(false); }}>Definir área temática</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setBatchEditorOpen(true); setAreaEditorOpen(false); }}>Editar conteúdo</button>
          <button type="submit" form="delete-selected-questions" className="btn btn-sm" style={{ background: "#dc2626", color: "#fff", border: "none" }} onClick={(event) => { if (!window.confirm(`Excluir ${selected.size} questão(ões)? Esta ação não pode ser desfeita.`)) event.preventDefault(); }}>Excluir selecionadas</button>
        </div>
      )}

      {isAreaEditorOpen && selectedQuestions.length > 0 && (
        <form action={areaAction} className="card" style={{ marginTop: "1rem", maxWidth: 720 }}>
          {[...selected].map((id) => <input key={id} type="hidden" name="id" value={id} />)}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", marginBottom: "0.9rem" }}>
            <div>
              <h2 style={{ fontSize: "1rem", margin: 0 }}>Definir área temática em lote</h2>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>Aplica a mesma área às {selected.size} questões selecionadas sem alterar os enunciados.</p>
            </div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAreaEditorOpen(false)}>Cancelar</button>
          </div>
          {areaState?.error && <p style={{ color: "#b91c1c", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{areaState.error}</p>}
          {areaState?.ok && <p style={{ color: "var(--success)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{areaState.count} questão(ões) atualizada(s).</p>}
          <label className="form-label" htmlFor="bulk-shared-thematic-area">Área temática para todas</label>
          <input id="bulk-shared-thematic-area" name="thematicArea" className="form-input" list="bulk-thematic-area-options" placeholder="Ex: Herança, Polimorfismo, Normalização…" autoFocus />
          <datalist id="bulk-thematic-area-options">
            {availableAreas.map((area) => <option key={area} value={area} />)}
          </datalist>
          <p style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: "0.45rem" }}>Deixe vazio para remover a área temática das questões selecionadas.</p>
          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary" disabled={isAreaPending}>{isAreaPending ? "Aplicando…" : `Aplicar a ${selected.size} questão(ões)`}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setAreaEditorOpen(false)} disabled={isAreaPending}>Cancelar</button>
          </div>
        </form>
      )}

      {isBatchEditorOpen && selectedQuestions.length > 0 && (
        <form action={batchAction} className="card" style={{ marginTop: "1rem", maxWidth: 900 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", marginBottom: "0.75rem" }}>
            <div><h2 style={{ fontSize: "1rem", margin: 0 }}>Editar em lote</h2><p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>Altera somente enunciado e área temática das questões selecionadas.</p></div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setBatchEditorOpen(false)}>Cancelar</button>
          </div>
          {batchState?.error && <p style={{ color: "#b91c1c", fontSize: "0.875rem" }}>{batchState.error}</p>}
          {batchState?.ok && <p style={{ color: "var(--success)", fontSize: "0.875rem" }}>{batchState.count} questão(ões) atualizada(s).</p>}
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {selectedQuestions.map((question) => (
              <fieldset key={question.id} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "0.75rem" }}>
                <legend style={{ fontSize: "0.8rem", fontWeight: 600, padding: "0 0.25rem" }}>Questão #{question.id}</legend>
                <input type="hidden" name="id" value={question.id} />
                <label className="form-label" htmlFor={`batch-statement-${question.id}`}>Enunciado *</label>
                <textarea id={`batch-statement-${question.id}`} name="statement" className="form-textarea" rows={3} required defaultValue={question.statement} />
                <label className="form-label" htmlFor={`batch-area-${question.id}`} style={{ marginTop: "0.6rem" }}>Área temática</label>
                <input id={`batch-area-${question.id}`} name="thematicArea" className="form-input" defaultValue={question.thematicArea ?? ""} />
              </fieldset>
            ))}
          </div>
          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary" disabled={isBatchPending}>{isBatchPending ? "Salvando…" : "Salvar alterações"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setBatchEditorOpen(false)} disabled={isBatchPending}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
