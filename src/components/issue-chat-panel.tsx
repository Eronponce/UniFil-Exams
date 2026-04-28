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
    <div style={{ marginLeft: "auto", width: expanded ? "100%" : "auto" }}>
      {expanded ? (
        <div
          style={{
            width: "100%",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
            overflow: "hidden",
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
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          style={{ boxShadow: "0 10px 24px rgba(15, 23, 42, 0.22)" }}
          onClick={() => setExpanded(true)}
        >
          GitHub issue
        </button>
      )}
    </div>
  );
}
