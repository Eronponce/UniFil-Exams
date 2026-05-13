"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import { buildGitHubIssueComposeUrl } from "@/lib/github/issue-compose";

interface ConfigState {
  enabled: boolean;
  repo: string | null;
  labels: string[];
  reason: string | null;
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  tone?: "default" | "success" | "error";
  href?: string;
}

function makeMessage(role: ChatMessage["role"], text: string, tone: ChatMessage["tone"] = "default", href?: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    tone,
    href,
  };
}

export function IssueChatPanel() {
  const pathname = usePathname();
  const { pushToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeMessage(
      "assistant",
      "Descreva um bug, ideia ou melhoria. Eu abro um rascunho de issue no GitHub deste projeto com tudo preenchido.",
    ),
  ]);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const response = await fetch("/api/github/issues", { cache: "no-store" });
        if (!response.ok || !active) return;
        const data = (await response.json()) as ConfigState;
        setConfig(data);
        if (!data.enabled && data.reason) {
          const reason = data.reason;
          setMessages((current) => {
            if (current.some((item) => item.text === reason)) return current;
            return [...current, makeMessage("assistant", reason, "error")];
          });
        }
      } catch {
        if (!active) return;
        setConfig({
          enabled: false,
          repo: null,
          labels: [],
          reason: "Nao foi possivel verificar a integracao com GitHub.",
        });
      }
    }

    loadConfig();
    return () => {
      active = false;
    };
  }, []);

  const repoLabel = config?.repo ?? "repo nao configurado";
  const canSend = input.trim().length >= 10 && !!config?.enabled;
  const footerLabel = useMemo(() => {
    if (!config) return "Verificando GitHub...";
    if (!config.enabled) return config.reason ?? "GitHub indisponivel";
    return `Destino: ${repoLabel}`;
  }, [config, repoLabel]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || !config?.enabled) return;

    setMessages((current) => [...current, makeMessage("user", message)]);
    setInput("");

    try {
      const url = buildGitHubIssueComposeUrl({
        repoSlug: repoLabel,
        message,
        path: pathname || undefined,
        labels: config.labels,
      });
      window.open(url, "_blank", "noopener,noreferrer");
      const successText = `Rascunho da issue aberto em ${repoLabel}. Se precisar, o GitHub vai pedir login antes do envio final.`;
      setMessages((current) => [...current, makeMessage("assistant", successText, "success", url)]);
      pushToast({ type: "success", title: "Rascunho aberto", description: "A issue foi aberta no GitHub com titulo e corpo preenchidos." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Falha ao abrir o GitHub.";
      setMessages((current) => [...current, makeMessage("assistant", errorMessage, "error")]);
      pushToast({ type: "error", title: "Falha ao abrir GitHub", description: errorMessage });
    }
  }

  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
      {expanded && (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: "calc(100% + 0.55rem)",
            width: "min(420px, calc(100vw - 2rem))",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
            overflow: "hidden",
            zIndex: 3,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 0.9rem", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <strong style={{ display: "block", fontSize: "0.88rem" }}>Chat de issue</strong>
              <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{footerLabel}</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded(false)}>
              Fechar
            </button>
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto", padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.65rem", background: "#f8fafc" }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  background:
                    message.role === "user"
                      ? "#dbeafe"
                      : message.tone === "success"
                      ? "#dcfce7"
                      : message.tone === "error"
                      ? "#fee2e2"
                      : "#fff",
                  color: "#111827",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                  borderRadius: 10,
                  padding: "0.65rem 0.75rem",
                  fontSize: "0.8rem",
                  lineHeight: 1.45,
                }}
              >
                <div>{message.text}</div>
                {message.href && (
                  <a href={message.href} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "0.45rem", color: "#1d4ed8", fontWeight: 600 }}>
                    Abrir issue
                  </a>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ padding: "0.85rem", borderTop: "1px solid #f3f4f6", background: "#fff" }}>
            <textarea
              className="form-textarea"
              rows={4}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Descreva o bug, melhoria ou ideia. A primeira linha vira o titulo da issue."
              disabled={!config?.enabled}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginTop: "0.65rem" }}>
              <span style={{ fontSize: "0.74rem", color: "#6b7280" }}>
                {config?.enabled ? "A primeira linha vira o titulo da issue. O envio final acontece no GitHub." : footerLabel}
              </span>
              <button type="submit" className="btn btn-primary" disabled={!canSend}>
                Abrir no GitHub
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        aria-label="Abrir chat de issue"
        title="Chat de issue"
        className="btn btn-primary"
        style={{
          width: 36,
          height: 36,
          minWidth: 36,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          boxShadow: "0 8px 20px rgba(15, 23, 42, 0.22)",
          lineHeight: 0,
        }}
        onClick={() => setExpanded((current) => !current)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="18"
          height="18"
          style={{ display: "block" }}
          fill="currentColor"
        >
          <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.69-1.08-2.69-1.08-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.89.87 2.35.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.58.82-2.14-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.14 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
      </button>
    </div>
  );
}
