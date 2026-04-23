"use client";

import { useEffect, useState } from "react";
import type { AIStatusEvent } from "@/lib/ai/stream";
import type { AITrace } from "@/lib/ai/trace";

const TYPE_LABEL: Record<string, string> = {
  objetiva: "Objetiva",
  verdadeiro_falso: "V ou F",
  dissertativa: "Dissertativa",
};

const PROVIDER_LABEL: Record<string, string> = {
  ollama: "Ollama",
  claude: "Claude API",
  gemini: "Gemini API",
};

function JsonBlock({ json }: { json: string }) {
  // Minimal syntax coloring: keys in blue, strings in green, numbers/booleans in orange
  const highlighted = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"([^"]+)":/g, '<span style="color:#93c5fd">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span style="color:#86efac">"$1"</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:#fcd34d">$1</span>')
    .replace(/: (-?\d+(\.\d+)?)/g, ': <span style="color:#fda4af">$1</span>');
  return (
    <pre
      style={{ margin: 0, fontSize: "0.78rem", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-all" }}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

function CollapsibleBlock({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: "0.6rem" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.78rem", padding: "0.1rem 0", display: "flex", alignItems: "center", gap: "0.35rem" }}
      >
        <span style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
        {label}
      </button>
      {open && (
        <div style={{ marginTop: "0.35rem", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 4, padding: "0.75rem", overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function RoundCard({ round }: { round: AITrace["rounds"][number] }) {
  const borderColor = round.succeeded ? "#16a34a" : "#dc2626";
  const label = round.succeeded ? `✓ Rodada ${round.round} — sucesso` : `✗ Rodada ${round.round} — falhou`;
  const labelColor = round.succeeded ? "#4ade80" : "#f87171";

  return (
    <div style={{ border: `1px solid ${borderColor}22`, borderLeft: `3px solid ${borderColor}`, borderRadius: 4, padding: "0.6rem 0.75rem", marginBottom: "0.5rem" }}>
      <p style={{ fontWeight: 600, fontSize: "0.82rem", color: labelColor, margin: "0 0 0.25rem" }}>{label}</p>

      {round.error && (
        <p style={{ fontSize: "0.76rem", color: "#f87171", margin: "0 0 0.25rem", fontFamily: "monospace" }}>
          ⚠ {round.error}
        </p>
      )}

      <CollapsibleBlock label="Prompt enviado">
        <pre style={{ margin: 0, fontSize: "0.76rem", color: "#cbd5e1", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}>
          {round.prompt}
        </pre>
      </CollapsibleBlock>

      {round.rawResponse && (
        <CollapsibleBlock label="Resposta bruta da IA">
          <pre style={{ margin: 0, fontSize: "0.76rem", color: "#cbd5e1", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}>
            {round.rawResponse}
          </pre>
        </CollapsibleBlock>
      )}

      {round.resultJson && (
        <CollapsibleBlock label="Estrutura parseada" defaultOpen={round.succeeded}>
          <JsonBlock json={round.resultJson} />
        </CollapsibleBlock>
      )}
    </div>
  );
}

function LiveEventRow({ event }: { event: AIStatusEvent }) {
  const color = event.tone === "success"
    ? "#4ade80"
    : event.tone === "error"
      ? "#f87171"
      : event.tone === "warning"
        ? "#facc15"
        : "#93c5fd";

  return (
    <div style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", fontSize: "0.76rem", padding: "0.35rem 0", borderBottom: "1px solid #334155" }}>
      <span style={{ color, fontWeight: 700, minWidth: 56 }}>
        {event.round ? `R${event.round}` : "SYS"}
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: "#e2e8f0", margin: 0 }}>{event.label}</p>
        {event.detail && <p style={{ color: "#94a3b8", margin: "0.15rem 0 0" }}>{event.detail}</p>}
      </div>
    </div>
  );
}

export function AITracePanel({
  trace,
  liveEvents = [],
  isStreaming = false,
}: {
  trace?: AITrace;
  liveEvents?: AIStatusEvent[];
  isStreaming?: boolean;
}) {
  const [open, setOpen] = useState(isStreaming);

  useEffect(() => {
    if (!isStreaming) return;
    const timer = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [isStreaming]);

  if (!trace && liveEvents.length === 0) return null;

  const statusColor = isStreaming
    ? "#93c5fd"
    : trace?.succeededRound !== null
      ? "#4ade80"
      : "#f87171";
  const succeededRound = trace?.succeededRound ?? null;
  const statusText = isStreaming
    ? "Execução em andamento"
    : succeededRound !== null
      ? `Gerado na rodada ${succeededRound} de ${trace?.rounds.length ?? 0}`
      : "Falhou em todas as rodadas";
  const roundCount = trace?.rounds.length ?? 0;

  return (
    <div style={{ marginTop: "1.5rem", background: "#1e293b", borderRadius: 8, padding: "0.85rem 1rem", fontFamily: "monospace" }}>
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8" }}>🔍 Processo interno da IA</span>
          <span style={{ fontSize: "0.75rem", color: statusColor }}>{statusText}</span>
          {isStreaming && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 0 4px rgba(56, 189, 248, 0.12)" }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {trace && (
            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
              {PROVIDER_LABEL[trace.provider] ?? trace.provider}
              {trace.model ? ` · ${trace.model}` : ""}
              {" · "}{TYPE_LABEL[trace.questionType] ?? trace.questionType}
            </span>
          )}
          <span style={{ color: "#64748b", fontSize: "0.78rem", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div style={{ marginTop: "0.75rem", borderTop: "1px solid #334155", paddingTop: "0.75rem" }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", fontSize: "0.72rem", color: "#64748b" }}>
            <span>Fluxo: prompt → resposta bruta → parse JSON → questão salva</span>
          </div>

          {liveEvents.length > 0 && (
            <div style={{ marginBottom: "0.9rem", border: "1px solid #334155", borderRadius: 6, padding: "0 0.75rem", background: "#0f172a" }}>
              {liveEvents.map((event) => <LiveEventRow key={event.id} event={event} />)}
            </div>
          )}

          {trace?.rounds.map((r) => <RoundCard key={r.round} round={r} />)}

          {roundCount > 1 ? (
            <p style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.5rem", margin: "0.5rem 0 0" }}>
              {roundCount} rodadas = prompts progressivamente mais simples para contornar erros de schema do modelo
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
