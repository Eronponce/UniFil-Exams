"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast-provider";
import {
  ANSWER_KEY_MAX_WIDTH_PT,
  ANSWER_KEY_MIN_WIDTH_PT,
  ANSWER_KEY_WIDTH_STEP_PT,
  clampAnswerKeyWidth,
  getAnswerKeyWidthPercent,
  getAnswerKeyWidthRatio,
} from "@/lib/pdf/answer-key-layout";

interface GabaritoStatusResponse {
  exists: boolean;
  url?: string;
  widthPt?: number;
}

export function GabaritoUpload({ examId, answerKeyWidthPt, isNew }: { examId: number; answerKeyWidthPt: number; isNew?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const saveSeqRef = useRef(0);
  const initialWidth = clampAnswerKeyWidth(answerKeyWidthPt);
  const [status, setStatus] = useState<{
    examId: number;
    hasFile: boolean | null;
    url: string | null;
    msg: { ok: boolean; text: string } | null;
  }>({ examId, hasFile: null, url: null, msg: null });
  const [savedWidthPt, setSavedWidthPt] = useState(initialWidth);
  const [draftWidthPt, setDraftWidthPt] = useState(initialWidth);
  const [widthMsg, setWidthMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { pushToast, updateToast } = useToast();

  const hasFile = status.examId === examId ? status.hasFile : null;
  const previewUrl = status.examId === examId ? status.url : null;
  const msg = status.examId === examId ? status.msg : null;
  const widthPercent = getAnswerKeyWidthPercent(draftWidthPt);
  const previewWidth = `${Math.max(26, getAnswerKeyWidthRatio(draftWidthPt) * 100)}%`;

  useEffect(() => {
    let active = true;
    fetch(`/api/upload/gabarito/${examId}`)
      .then((r) => r.json())
      .then((d: GabaritoStatusResponse) => {
        if (!active) return;
        const fetchedWidth = clampAnswerKeyWidth(d.widthPt ?? answerKeyWidthPt);
        setStatus({ examId, hasFile: d.exists, url: d.url ?? null, msg: null });
        setSavedWidthPt(fetchedWidth);
        setDraftWidthPt(fetchedWidth);
      })
      .catch(() => {
        if (!active) return;
        setStatus({ examId, hasFile: false, url: null, msg: null });
      });
    return () => {
      active = false;
    };
  }, [examId, answerKeyWidthPt]);

  useEffect(() => {
    const normalizedDraft = clampAnswerKeyWidth(draftWidthPt);
    if (normalizedDraft === savedWidthPt) return;

    const requestId = ++saveSeqRef.current;
    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/upload/gabarito/${examId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widthPt: normalizedDraft }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; widthPt?: number };

        if (saveSeqRef.current !== requestId) return;
        if (!res.ok) {
          setWidthMsg({ ok: false, text: data.error ?? "Erro ao salvar tamanho." });
          return;
        }

        const persistedWidth = clampAnswerKeyWidth(data.widthPt ?? normalizedDraft);
        setSavedWidthPt(persistedWidth);
        setDraftWidthPt(persistedWidth);
        setWidthMsg({ ok: true, text: "Tamanho salvo." });
      } catch {
        if (saveSeqRef.current === requestId) {
          setWidthMsg({ ok: false, text: "Erro ao salvar tamanho." });
        }
      }
    }, 260);

    return () => window.clearTimeout(timeoutId);
  }, [draftWidthPt, examId, savedWidthPt]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = pushToast({
      type: "info",
      title: "Enviando gabarito",
      description: `Upload iniciado para a prova ${examId}.`,
    });

    startTransition(async () => {
      setStatus((current) => ({
        examId,
        hasFile: current.examId === examId ? current.hasFile : null,
        url: current.examId === examId ? current.url : null,
        msg: null,
      }));

      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/upload/gabarito/${examId}`, { method: "POST", body: form });

      if (res.ok) {
        setStatus((current) => ({
          examId,
          hasFile: true,
          url: current.url,
          msg: { ok: true, text: "Gabarito salvo. Gere o PDF novamente." },
        }));

        fetch(`/api/upload/gabarito/${examId}`)
          .then((r) => r.json())
          .then((d: GabaritoStatusResponse) => {
            setStatus((current) => ({
              examId,
              hasFile: d.exists,
              url: d.url ?? current.url,
              msg: current.msg,
            }));
            const fetchedWidth = clampAnswerKeyWidth(d.widthPt ?? savedWidthPt);
            setSavedWidthPt(fetchedWidth);
            setDraftWidthPt(fetchedWidth);
          })
          .catch(() => null);

        updateToast(toastId, {
          type: "success",
          title: "Gabarito salvo",
          description: "O PDF ja pode ser gerado com a ultima pagina anexada.",
        });
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus((current) => ({
          examId,
          hasFile: false,
          url: current.examId === examId ? current.url : null,
          msg: { ok: false, text: j.error ?? "Erro ao enviar" },
        }));

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
      {!isNew && <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>Gabarito (ultima pagina do PDF)</p>}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
        {hasFile === null && <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Verificando...</span>}
        {hasFile === false && <span style={{ fontSize: "0.8rem", color: "#b45309", background: "#fef3c7", padding: "0.15rem 0.5rem", borderRadius: 4 }}>Sem gabarito anexado</span>}
        {hasFile === true && <span style={{ fontSize: "0.8rem", color: "#15803d", background: "#dcfce7", padding: "0.15rem 0.5rem", borderRadius: 4 }}>OK Gabarito anexado</span>}
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
          {pending ? "Enviando..." : hasFile ? "Substituir Gabarito" : "Anexar Gabarito (PNG/JPG)"}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            style={{ display: "none" }}
            disabled={pending}
            onChange={handleChange}
          />
        </label>
        {msg && <span style={{ fontSize: "0.8rem", color: msg.ok ? "#16a34a" : "#dc2626" }}>{msg.text}</span>}
      </div>

      <div
        style={{
          marginTop: "1rem",
          borderTop: "1px solid var(--border)",
          paddingTop: "1rem",
          display: "grid",
          gap: "0.85rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.2rem" }}>Tamanho do gabarito no PDF</p>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Ajusta a largura da imagem em pontos, proporcional a area util da pagina.</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <strong style={{ fontSize: "0.95rem" }}>{draftWidthPt}pt</strong>
            <div style={{ fontSize: "0.76rem", color: "var(--muted)" }}>{widthPercent}% da largura util</div>
          </div>
        </div>

        <input
          type="range"
          min={ANSWER_KEY_MIN_WIDTH_PT}
          max={ANSWER_KEY_MAX_WIDTH_PT}
          step={ANSWER_KEY_WIDTH_STEP_PT}
          value={draftWidthPt}
          onChange={(e) => {
            setDraftWidthPt(clampAnswerKeyWidth(Number(e.target.value)));
            setWidthMsg({ ok: true, text: "Salvando tamanho..." });
          }}
          style={{ width: "100%" }}
          aria-label="Tamanho do gabarito"
        />

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--muted)" }}>
          <span>{ANSWER_KEY_MIN_WIDTH_PT}pt</span>
          <span>{ANSWER_KEY_MAX_WIDTH_PT}pt</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, 220px) 1fr",
            gap: "1rem",
            alignItems: "start",
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "210 / 297",
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "0.75rem",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                border: "1px dashed #cbd5e1",
                borderRadius: 8,
                padding: "0.65rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.45rem",
                overflow: "hidden",
              }}
            >
              <div style={{ height: 12, width: "52%", background: "#cbd5e1", borderRadius: 999 }} />
              <div style={{ height: 6, width: "82%", background: "#e2e8f0", borderRadius: 999 }} />
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", overflow: "hidden" }}>
                {previewUrl ? (
                  <div
                    style={{
                      width: previewWidth,
                      maxWidth: "100%",
                      maxHeight: "48%",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Previa do gabarito"
                      style={{
                        display: "block",
                        width: "100%",
                        height: "auto",
                        maxHeight: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: previewWidth,
                      maxWidth: "100%",
                      minHeight: 44,
                      padding: "0.55rem 0.4rem",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      background: "repeating-linear-gradient(180deg, #ffffff 0, #ffffff 8px, #f8fafc 8px, #f8fafc 16px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#64748b",
                      fontSize: "0.72rem",
                      textAlign: "center",
                    }}
                  >
                    Previa da largura do gabarito
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.45rem" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              A moldura simula a pagina A4. O bloco desce ate o rodape para mostrar como o gabarito fica na ultima pagina.
            </p>
            <div style={{ padding: "0.65rem 0.75rem", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.78rem", color: "#0f172a", marginBottom: "0.2rem", fontWeight: 600 }}>Leitura rapida</div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                Menor tamanho = menos dominancia visual e mais respiro na pagina final.
              </div>
            </div>
            {widthMsg && <span style={{ fontSize: "0.78rem", color: widthMsg.ok ? "#16a34a" : "#dc2626" }}>{widthMsg.text}</span>}
          </div>
        </div>
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
        setMsg({ ok: true, text: "Logo salva." });
        updateToast(toastId, {
          type: "success",
          title: "Logo atualizada",
          description: "Os proximos PDFs usarao a nova identidade visual.",
        });
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
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
          {pending ? "Enviando..." : "Alterar Logo"}
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
