"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { useToast } from "@/components/toast-provider";

export function GabaritoUpload({ examId, isNew }: { examId: number; isNew?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    examId: number;
    hasFile: boolean | null;
    msg: { ok: boolean; text: string } | null;
  }>({ examId, hasFile: null, msg: null });
  const { pushToast, updateToast } = useToast();

  const hasFile = status.examId === examId ? status.hasFile : null;
  const msg = status.examId === examId ? status.msg : null;

  useEffect(() => {
    let active = true;
    fetch(`/api/upload/gabarito/${examId}`)
      .then((r) => r.json())
      .then((d: { exists: boolean }) => {
        if (active) setStatus({ examId, hasFile: d.exists, msg: null });
      })
      .catch(() => {
        if (active) setStatus({ examId, hasFile: false, msg: null });
      });
    return () => {
      active = false;
    };
  }, [examId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = pushToast({
      type: "info",
      title: "Enviando gabarito",
      description: `Upload iniciado para a prova ${examId}.`,
    });
    startTransition(async () => {
      setStatus((current) => ({ examId, hasFile: current.examId === examId ? current.hasFile : null, msg: null }));
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/upload/gabarito/${examId}`, { method: "POST", body: form });
      if (res.ok) {
        setStatus({ examId, hasFile: true, msg: { ok: true, text: "Gabarito salvo! Baixe o PDF novamente." } });
        updateToast(toastId, {
          type: "success",
          title: "Gabarito salvo",
          description: "O PDF já pode ser gerado com a última página anexada.",
        });
      } else {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setStatus({ examId, hasFile: false, msg: { ok: false, text: j.error ?? "Erro ao enviar" } });
        updateToast(toastId, {
          type: "error",
          title: "Falha no upload do gabarito",
          description: j.error ?? "Erro ao enviar arquivo.",
        });
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  const containerStyle = isNew
    ? { background: "#eef2ff", border: "1.5px solid #6366f1", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }
    : { marginBottom: "1.25rem" };

  return (
    <div style={containerStyle}>
      {isNew && (
        <p style={{ fontWeight: 600, color: "#4338ca", marginBottom: "0.5rem" }}>
          Prova criada! Anexe o gabarito para incluir no PDF:
        </p>
      )}
      {!isNew && <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>Gabarito (última página do PDF)</p>}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
        {hasFile === null && <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Verificando…</span>}
        {hasFile === false && <span style={{ fontSize: "0.8rem", color: "#b45309", background: "#fef3c7", padding: "0.15rem 0.5rem", borderRadius: 4 }}>Sem gabarito anexado</span>}
        {hasFile === true && <span style={{ fontSize: "0.8rem", color: "#15803d", background: "#dcfce7", padding: "0.15rem 0.5rem", borderRadius: 4 }}>✓ Gabarito anexado</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-block",
            padding: "0.4rem 1rem",
            border: `1px solid ${isNew ? "#6366f1" : "var(--border)"}`,
            borderRadius: 6,
            cursor: pending ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            background: isNew ? "#eef2ff" : "var(--bg)",
            color: isNew ? "#4338ca" : "inherit",
            fontWeight: isNew ? 600 : 400,
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Enviando…" : hasFile ? "Substituir Gabarito" : "📎 Anexar Gabarito (PNG/JPG)"}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            style={{ display: "none" }}
            disabled={pending}
            onChange={handleChange}
          />
        </label>
        {msg && (
          <span style={{ fontSize: "0.8rem", color: msg.ok ? "#16a34a" : "#dc2626" }}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

export function LogoUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { pushToast, updateToast } = useToast();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = pushToast({
      type: "info",
      title: "Enviando logo",
      description: "Atualizando imagem institucional do PDF.",
    });
    startTransition(async () => {
      setMsg(null);
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: form });
      if (res.ok) {
        setMsg({ ok: true, text: "Logo salva!" });
        updateToast(toastId, {
          type: "success",
          title: "Logo atualizada",
          description: "Os próximos PDFs usarão a nova identidade visual.",
        });
      } else {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setMsg({ ok: false, text: j.error ?? "Erro ao enviar" });
        updateToast(toastId, {
          type: "error",
          title: "Falha no upload da logo",
          description: j.error ?? "Erro ao enviar arquivo.",
        });
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-block",
            padding: "0.35rem 0.75rem",
            border: "1px solid var(--border)",
            borderRadius: 6,
            cursor: pending ? "not-allowed" : "pointer",
            fontSize: "0.8rem",
            background: "var(--bg)",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Enviando…" : "📎 Alterar Logo"}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            style={{ display: "none" }}
            disabled={pending}
            onChange={handleChange}
          />
        </label>
        {msg && <span style={{ fontSize: "0.75rem", color: msg.ok ? "#16a34a" : "#dc2626" }}>{msg.text}</span>}
      </div>
    </div>
  );
}
