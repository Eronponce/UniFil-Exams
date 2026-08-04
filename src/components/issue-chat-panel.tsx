"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/toast-provider";
import { buildGitHubIssueComposeUrl } from "@/lib/github/issue-compose";
import { Icon } from "@/components/icon";

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
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, text, tone, href };
}

export function IssueChatPanel() {
  const pathname = usePathname();
  const { pushToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeMessage("assistant", "Descreva um bug, ideia ou melhoria. Eu abro um rascunho de issue no GitHub deste projeto com tudo preenchido."),
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
          setMessages((current) => current.some((item) => item.text === reason) ? current : [...current, makeMessage("assistant", reason, "error")]);
        }
      } catch {
        if (!active) return;
        setConfig({ enabled: false, repo: null, labels: [], reason: "Não foi possível verificar a integração com GitHub." });
      }
    }
    loadConfig();
    return () => { active = false; };
  }, []);

  const repoLabel = config?.repo ?? "repo não configurado";
  const canSend = input.trim().length >= 10 && !!config?.enabled;
  const footerLabel = useMemo(() => {
    if (!config) return "Verificando GitHub...";
    if (!config.enabled) return config.reason ?? "GitHub indisponível";
    return `Destino: ${repoLabel}`;
  }, [config, repoLabel]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || !config?.enabled) return;
    setMessages((current) => [...current, makeMessage("user", message)]);
    setInput("");
    try {
      const url = buildGitHubIssueComposeUrl({ repoSlug: repoLabel, message, path: pathname || undefined, labels: config.labels });
      window.open(url, "_blank", "noopener,noreferrer");
      setMessages((current) => [...current, makeMessage("assistant", `Rascunho da issue aberto em ${repoLabel}. Se precisar, o GitHub vai pedir login antes do envio final.`, "success", url)]);
      pushToast({ type: "success", title: "Rascunho aberto", description: "A issue foi aberta no GitHub com título e corpo preenchidos." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Falha ao abrir o GitHub.";
      setMessages((current) => [...current, makeMessage("assistant", errorMessage, "error")]);
      pushToast({ type: "error", title: "Falha ao abrir GitHub", description: errorMessage });
    }
  }

  return (
    <div className="issue-chat">
      {expanded && (
        <section className="issue-chat-popover" id="issue-chat-content" aria-label="Chat de issue">
          <header className="issue-chat-header">
            <div><strong>Ajuda e feedback</strong><span>{footerLabel}</span></div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded(false)}>Fechar</button>
          </header>
          <div className="issue-chat-messages" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`issue-message issue-message-${message.role}${message.tone && message.tone !== "default" ? ` issue-message-${message.tone}` : ""}`}>
                <div>{message.text}</div>
                {message.href && <a href={message.href} target="_blank" rel="noreferrer">Abrir issue</a>}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="issue-chat-form">
            <textarea className="form-textarea" rows={4} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Descreva o bug, melhoria ou ideia. A primeira linha vira o título da issue." disabled={!config?.enabled} />
            <div className="issue-chat-form-footer"><span>{config?.enabled ? "A primeira linha vira o título. O envio final acontece no GitHub." : footerLabel}</span><button type="submit" className="btn btn-primary" disabled={!canSend}>Abrir no GitHub</button></div>
          </form>
        </section>
      )}
      <button type="button" className="issue-chat-button" aria-label="Abrir chat de issue" aria-expanded={expanded} aria-controls="issue-chat-content" title="Ajuda e feedback" onClick={() => setExpanded((current) => !current)}>
        <Icon name={expanded ? "close" : "message"} size={19} />
      </button>
    </div>
  );
}
