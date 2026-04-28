export const dynamic = "force-dynamic";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { listDisciplines } from "@/lib/db/disciplines";
import { AuditFilters } from "./_components/audit-filters";
import { AuditCardActions } from "./_components/audit-card-actions";
import { AuditPendingActions } from "./_components/audit-pending-actions";

import type { Question } from "@/types";
import { MarkdownText } from "@/components/markdown-text";
import {
  RICH_TEXT_ALLOWED_STYLE_LABEL,
  RICH_TEXT_ALLOWED_TAGS_LABEL,
  truncateRichTextPlain,
} from "@/lib/html/rich-text";
import { deleteAllRejectedAction, rejectQuestionAction } from "@/lib/actions/questions";
import { ConfirmButton } from "@/components/confirm-button";

const LETTERS = ["A", "B", "C", "D", "E"];

function OptionsDisplay({ q }: { q: Question }) {
  if (q.questionType === "dissertativa") {
    return <p style={{ fontSize: "0.85rem", opacity: 0.65 }}>{q.answerLines} linha{q.answerLines !== 1 ? "s" : ""} em branco no PDF</p>;
  }
  if (q.questionType === "verdadeiro_falso") {
    return (
      <div style={{ display: "flex", gap: "1rem" }}>
        {["Verdadeiro", "Falso"].map((label, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", padding: "0.2rem 0", color: i === q.correctIndex ? "var(--success)" : "var(--text)", fontWeight: i === q.correctIndex ? 600 : 400, fontSize: "0.875rem" }}>
            <span>{i === 0 ? "V" : "F"}.</span><span>{label}</span>
            {i === q.correctIndex && <span>✓</span>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      {q.options.map((opt) => (
        <div key={opt.index} style={{ display: "flex", gap: "0.5rem", padding: "0.35rem 0", color: opt.index === q.correctIndex ? "var(--success)" : "var(--text)", fontWeight: opt.index === q.correctIndex ? 600 : 400, fontSize: "0.875rem" }}>
          <span>{LETTERS[opt.index]}.</span><span>{opt.text}</span>
          {opt.index === q.correctIndex && <span>✓</span>}
        </div>
      ))}
    </div>
  );
}

function ExplanationDisplay({ q }: { q: Question }) {
  if (!q.explanation) {
    return (
      <p style={{ fontSize: "0.78rem", color: "var(--muted)", fontStyle: "italic", marginTop: "0.4rem" }}>
        Sem justificativa cadastrada.
      </p>
    );
  }
  return (
    <div style={{ marginTop: "0.5rem", fontSize: "0.825rem", color: "#1e40af", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "0.4rem 0.7rem" }}>
      <strong>{q.questionType === "dissertativa" ? "Gabarito esperado:" : "Justificativa:"}</strong> {q.explanation}
    </div>
  );
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ discipline?: string }> }) {
  const sp = await searchParams;
  const disciplineId = sp.discipline ? Number(sp.discipline) : undefined;
  const disciplines = listDisciplines();
  const pending = listQuestionsFiltered({ audited: false, rejected: false, disciplineId });
  const audited = listQuestionsFiltered({ audited: true, rejected: false, disciplineId });
  const rejected = listQuestionsFiltered({ rejected: true, disciplineId });

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Auditoria</h1>
        <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>{pending.length} pendente(s) · {audited.length} auditada(s) · {rejected.length} recusada(s)</span>
      </div>

      <AuditFilters disciplines={disciplines} />
      <div className="card" style={{ marginBottom: "1rem", fontSize: "0.82rem", color: "var(--muted)" }}>
        Enunciados aceitam HTML sanitizado. Tags: {RICH_TEXT_ALLOWED_TAGS_LABEL}. Styles: {RICH_TEXT_ALLOWED_STYLE_LABEL}.
      </div>

      {/* Seção pendentes */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "0.9rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "0.75rem" }}>
          Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
            Nenhuma questão pendente. 🎉
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {pending.map((q) => (
              <div key={q.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}><MarkdownText text={q.statement} /></div>
                    <OptionsDisplay q={q} />
                    <ExplanationDisplay q={q} />
                  </div>
                  <AuditPendingActions questionId={q.id} />
                </div>
                <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, padding: "0.15rem 0.5rem", borderRadius: 99, background: "#fef9c3", color: "#92400e" }}>
                    ⏳ Pendente
                  </span>
                  <span className="badge" style={{ background: "#f3f4f6" }}>{q.difficulty}</span>
                  <span className={q.source === "ai" ? "badge badge-ai" : "badge"}>{q.source}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção recusadas */}
      {rejected.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <h2 style={{ fontSize: "0.9rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
              Recusadas ({rejected.length})
            </h2>
            <form action={deleteAllRejectedAction}>
              {disciplineId && <input type="hidden" name="disciplineId" value={disciplineId} />}
              <ConfirmButton
                type="submit"
                className="btn btn-sm"
                style={{ background: "#dc2626", color: "#fff", border: "none" }}
                confirm={`Excluir todas as ${rejected.length} questão(ões) recusadas? Esta ação não pode ser desfeita.`}
              >
                Excluir todas recusadas
              </ConfirmButton>
            </form>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {rejected.map((q) => (
              <div key={q.id} className="card" style={{ opacity: 0.75, borderLeft: "3px solid #f97316", padding: "0.6rem 0.9rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                  <span style={{ fontSize: "0.875rem", flex: 1 }}>{truncateRichTextPlain(q.statement, 100)}</span>
                  <form action={rejectQuestionAction}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="value" value="0" />
                    <button type="submit" className="btn btn-ghost btn-sm" style={{ whiteSpace: "nowrap" }}>↩ Restaurar</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seção auditadas */}
      <div id="auditadas" style={{ scrollMarginTop: "1rem" }}>
        <h2 style={{ fontSize: "0.9rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "0.75rem" }}>
          Auditadas ({audited.length})
        </h2>
        {audited.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
            Nenhuma questão auditada ainda.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {audited.map((q) => (
              <div key={q.id} className="card" style={{ opacity: 0.85 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: "0.5rem", fontSize: "0.9rem" }}><MarkdownText text={q.statement} /></div>
                    <OptionsDisplay q={q} />
                    <ExplanationDisplay q={q} />
                  </div>
                  <AuditCardActions questionId={q.id} />
                </div>
                <div style={{ marginTop: "0.4rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, padding: "0.15rem 0.5rem", borderRadius: 99, background: "#dcfce7", color: "#166534" }}>
                    ✓ Auditada
                  </span>
                  <span className="badge" style={{ background: "#f3f4f6" }}>{q.difficulty}</span>
                  <span className={q.source === "ai" ? "badge badge-ai" : "badge"}>{q.source}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
