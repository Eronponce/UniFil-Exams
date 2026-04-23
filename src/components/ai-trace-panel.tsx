"use client";

import { useState } from "react";
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

export function AITracePanel({ trace }: { trace: AITrace }) {
  const [open, setOpen] = useState(false);

  const statusColor = trace.succeededRound !== null ? "#4ade80" : "#f87171";
  const statusText = trace.succeededRound !== null
    ? `Gerado na rodada ${trace.succeededRound} de ${trace.rounds.length}`
    : "Falhou em todas as rodadas";

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
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
            {PROVIDER_LABEL[trace.provider] ?? trace.provider}
            {trace.model ? ` · ${trace.model}` : ""}
            {" · "}{TYPE_LABEL[trace.questionType] ?? trace.questionType}
          </span>
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

          {trace.rounds.map((r) => <RoundCard key={r.round} round={r} />)}

          {trace.rounds.length > 1 && (
            <p style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.5rem", margin: "0.5rem 0 0" }}>
              {trace.rounds.length} rodadas = prompts progressivamente mais simples para contornar erros de schema do modelo
            </p>
          )}
        </div>
      )}
    </div>
  );
}
