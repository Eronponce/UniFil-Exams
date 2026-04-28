"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MarkdownText } from "@/components/markdown-text";
import { QuestionExportFileSchema, parseCsvQuestions, type ExportedQuestion } from "@/lib/importexport/types";
import { importQuestionsFromJsonAction } from "@/lib/actions/import";
import { useToast } from "@/components/toast-provider";
import {
  RICH_TEXT_ALLOWED_ATTRIBUTE_LABEL,
  RICH_TEXT_ALLOWED_STYLE_LABEL,
  RICH_TEXT_ALLOWED_TAGS_LABEL,
  RICH_TEXT_BLOCKED_FEATURES_LABEL,
} from "@/lib/html/rich-text";
import { buildImportPrompt } from "@/lib/ai/prompt-templates";

interface Discipline { id: number; name: string }

const TYPE_LABEL: Record<string, string> = { objetiva: "Objetiva", verdadeiro_falso: "V/F", dissertativa: "Dissertativa" };
const TYPE_COLOR: Record<string, string> = { objetiva: "#dbeafe", verdadeiro_falso: "#fef9c3", dissertativa: "#f3e8ff" };
const DIFF_LABEL: Record<string, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const DIFF_COLOR: Record<string, string> = { easy: "#bbf7d0", medium: "#fef08a", hard: "#fecaca" };

// ── Template data ─────────────────────────────────────────────────────────────
const TEMPLATE_QUESTIONS = [
  {
    type: "objetiva",
    typeLabel: "Objetiva",
    statement: "Qual linguagem é utilizada para estilizar páginas web?",
    preview: "A) HTML · B) CSS ✓ · C) JavaScript · D) Python · E) Java",
    note: "5 opções • correct_index = 1",
  },
  {
    type: "verdadeiro_falso",
    typeLabel: "V ou F",
    statement: "O protocolo HTTP não mantém estado entre requisições consecutivas.",
    preview: "Correto: Verdadeiro",
    note: "correct_index = 0 (Verdadeiro) ou 1 (Falso)",
  },
  {
    type: "dissertativa",
    typeLabel: "Dissertativa",
    statement: "Explique o conceito de herança na programação orientada a objetos e apresente um exemplo prático.",
    preview: "8 linhas em branco no PDF",
    note: "options vazio • answer_lines = 8",
  },
];

const TEMPLATE_JSON = JSON.stringify(
  {
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    questions: [
      {
        statement: "Qual linguagem é utilizada para estilizar páginas web?",
        questionType: "objetiva",
        options: ["HTML", "CSS", "JavaScript", "Python", "Java"],
        correctIndex: 1,
        difficulty: "easy",
        thematicArea: "Desenvolvimento Web",
        explanation: "CSS é a linguagem responsável pela apresentação visual de páginas HTML.",
        answerLines: 0,
      },
      {
        statement: "O protocolo HTTP não mantém estado entre requisições consecutivas.",
        questionType: "verdadeiro_falso",
        options: ["Verdadeiro", "Falso"],
        correctIndex: 0,
        difficulty: "medium",
        thematicArea: "Redes de Computadores",
        explanation: "HTTP é stateless: cada requisição é independente e não há sessão automática.",
        answerLines: 0,
      },
      {
        statement: "Explique o conceito de herança na programação orientada a objetos e apresente um exemplo prático.",
        questionType: "dissertativa",
        options: [],
        correctIndex: 0,
        difficulty: "medium",
        thematicArea: "Programação Orientada a Objetos",
        explanation: "Espera-se que o aluno descreva reutilização de código e hierarquia de classes.",
        answerLines: 8,
      },
    ],
  },
  null,
  2,
);

const TEMPLATE_CSV = [
  "statement,question_type,difficulty,option_a,option_b,option_c,option_d,option_e,correct_index,thematic_area,answer_lines,explanation",
  "Qual linguagem é utilizada para estilizar páginas web?,objetiva,easy,HTML,CSS,JavaScript,Python,Java,1,Desenvolvimento Web,0,CSS é a linguagem responsável pela apresentação visual de páginas HTML.",
  "O protocolo HTTP não mantém estado entre requisições consecutivas.,verdadeiro_falso,medium,Verdadeiro,Falso,,,,0,Redes de Computadores,0,HTTP é stateless: cada requisição é independente e não há sessão automática.",
  "Explique o conceito de herança na POO e apresente um exemplo prático.,dissertativa,medium,,,,,,0,Programação Orientada a Objetos,8,Espera-se que o aluno descreva reutilização de código e hierarquia de classes.",
].join("\n");

const AI_PROMPT = `Você receberá um arquivo de template em anexo com o formato de questões esperado. Gere questões estritamente nesse formato JSON, respeitando todas as regras abaixo.

REGRAS GERAIS
• Use exatamente os campos do template: statement, questionType, options, correctIndex, difficulty, thematicArea, explanation, answerLines.
• Valores válidos — questionType: "objetiva" | "verdadeiro_falso" | "dissertativa". difficulty: "easy" | "medium" | "hard".
• Retorne apenas o JSON válido, sem texto fora do objeto.
• O campo statement pode conter HTML sanitizado.
• Tags permitidas no statement: ${RICH_TEXT_ALLOWED_TAGS_LABEL}.
• Atributos permitidos no statement: ${RICH_TEXT_ALLOWED_ATTRIBUTE_LABEL}.
• Styles permitidos no statement: ${RICH_TEXT_ALLOWED_STYLE_LABEL}.
• ${RICH_TEXT_BLOCKED_FEATURES_LABEL}.

QUESTÕES OBJETIVAS (questionType: "objetiva")
• Sempre exatamente 5 alternativas (options com 5 itens).
• Apenas UMA alternativa correta; correctIndex indica o índice (base 0).
• As alternativas incorretas devem ser plausíveis, tecnicamente relacionadas ao tema e não trivialmente diferentes da correta.
• Evite alternativas absurdas ou visivelmente erradas sem análise.
• Proibido usar palavras absolutas no enunciado ou nas alternativas: "sempre", "nunca", "somente", "todos", "nenhum", "jamais", "absolutamente", "apenas".

QUESTÕES VERDADEIRO OU FALSO (questionType: "verdadeiro_falso")
• options deve ter exatamente 2 itens: ["Verdadeiro", "Falso"].
• correctIndex: 0 para Verdadeiro, 1 para Falso.
• O enunciado deve ser uma afirmação factual, clara e sem ambiguidade — deve ser inequivocamente verdadeira ou falsa, sem espaço para interpretação.

QUESTÕES DISSERTATIVAS (questionType: "dissertativa")
• options deve ser um array vazio: [].
• correctIndex deve ser 0.
• O enunciado deve ser objetivo e direto, pedindo uma resposta específica e delimitada.
• explanation deve conter o gabarito esperado de forma resumida (máximo 3 frases curtas).
• answerLines: número de linhas em branco no PDF — use entre 4 e 12, proporcional à complexidade da resposta esperada.`;

const IMPORT_AI_PROMPT = buildImportPrompt() || AI_PROMPT;

function downloadTemplate(format: "json" | "csv") {
  const content = format === "json" ? TEMPLATE_JSON : TEMPLATE_CSV;
  const mimeType = format === "json" ? "application/json" : "text/csv;charset=utf-8";
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `template-questoes.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyTemplate(format: "json" | "csv"): Promise<boolean> {
  const content = format === "json" ? TEMPLATE_JSON : TEMPLATE_CSV;
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ImportFileClient({ disciplines }: { disciplines: Discipline[] }) {
  const [step, setStep] = useState<"input" | "preview" | "done">("input");
  const [questions, setQuestions] = useState<ExportedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [disciplineId, setDisciplineId] = useState<number>(disciplines[0]?.id ?? 0);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  const [copied, setCopied] = useState<"json" | "csv" | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const { pushToast, updateToast } = useToast();

  async function handlePromptCopy() {
    try {
      await navigator.clipboard.writeText(IMPORT_AI_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
    } catch { /* ignore */ }
  }

  async function handleCopy(format: "json" | "csv") {
    const ok = await copyTemplate(format);
    if (ok) {
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  function handleFileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("questionFile") as File | null;
    const selDiscipline = Number(fd.get("disciplineId"));
    if (!file || !selDiscipline) return;
    setDisciplineId(selDiscipline);
    setError(undefined);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        let qs: ExportedQuestion[];
        if (file.name.toLowerCase().endsWith(".json")) {
          qs = QuestionExportFileSchema.parse(JSON.parse(text)).questions;
        } else {
          qs = parseCsvQuestions(text);
          if (!qs.length) throw new Error("Nenhuma questão encontrada no CSV.");
        }
        setQuestions(qs);
        setSelected(new Set(qs.map((_, i) => i)));
        setStep("preview");
        pushToast({
          type: "success",
          title: "Arquivo carregado",
          description: `${qs.length} questão(ões) pronta(s) para revisão antes da importação.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao ler arquivo.";
        setError(message);
        pushToast({
          type: "error",
          title: "Falha ao ler arquivo",
          description: message,
        });
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(questions.map((_, i) => i)) : new Set());
  }

  function toggleOne(i: number, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(i); else next.delete(i);
    setSelected(next);
  }

  function handleSave() {
    const toSave = questions.filter((_, i) => selected.has(i));
    setError(undefined);
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), questions: toSave });
    const toastId = pushToast({
      type: "info",
      title: "Importando questões",
      description: "Persistindo arquivo revisado no banco.",
    });
    startSaving(async () => {
      const result = await importQuestionsFromJsonAction(payload, disciplineId);
      if (result.errors.length) {
        setError(result.errors[0]);
        updateToast(toastId, {
          type: "error",
          title: "Falha na importação",
          description: result.errors[0],
        });
      } else {
        setSavedCount(result.count);
        setStep("done");
        updateToast(toastId, {
          type: "success",
          title: "Importação concluída",
          description: `${result.count} questão(ões) adicionada(s) ao banco.`,
        });
      }
    });
  }

  function reset() {
    setStep("input"); setQuestions([]); setSelected(new Set());
    setSavedCount(0); setError(undefined);
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <>
        <div className="page-header"><h1 className="page-title">Importação Concluída</h1></div>
        <div className="card" style={{ maxWidth: 480, textAlign: "center", padding: "2rem" }}>
          <p style={{ fontSize: "3rem", margin: "0 0 0.5rem" }}>✓</p>
          <p style={{ fontSize: "1.1rem", marginBottom: "1.5rem" }}>
            <strong>{savedCount}</strong> questão{savedCount !== 1 ? "ões" : ""} importada{savedCount !== 1 ? "s" : ""} com sucesso!
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <Link href="/questions" className="btn btn-primary">Ver Banco de Questões</Link>
            <button className="btn btn-ghost" onClick={reset}>Importar mais</button>
          </div>
        </div>
      </>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  if (step === "preview") {
    const allSelected = selected.size === questions.length;
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Revisar Questões ({questions.length} encontradas)</h1>
          <button className="btn btn-ghost" onClick={reset}>← Voltar</button>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label className="form-label">Salvar na disciplina:</label>
          <select
            className="form-select"
            style={{ maxWidth: 280 }}
            value={disciplineId}
            onChange={(e) => setDisciplineId(Number(e.target.value))}
          >
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
            Selecionar todas ({selected.size}/{questions.length})
          </label>
          <button className="btn btn-primary" disabled={selected.size === 0 || saving} onClick={handleSave}>
            {saving ? "Salvando..." : `Importar selecionadas (${selected.size})`}
          </button>
          {error && <span style={{ color: "#dc2626" }}>{error}</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {questions.map((q, i) => (
            <div key={i} className="card" style={{ padding: "1rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <input type="checkbox" checked={selected.has(i)} onChange={(e) => toggleOne(i, e.target.checked)} style={{ marginTop: "0.25rem", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                    <span>{i + 1}. </span>
                    <MarkdownText text={q.statement} />
                  </div>
                  {q.questionType === "objetiva" && q.options.length > 0 && (
                    <ol type="A" style={{ margin: 0, paddingLeft: "1.5rem", marginBottom: "0.5rem" }}>
                      {q.options.map((opt, oi) => (
                        <li key={oi} style={{ color: oi === q.correctIndex ? "#16a34a" : "inherit", fontWeight: oi === q.correctIndex ? 600 : 400, marginBottom: "0.15rem" }}>
                          {opt}
                        </li>
                      ))}
                    </ol>
                  )}
                  {q.questionType === "verdadeiro_falso" && (
                    <p style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                      Correto: <strong style={{ color: "#16a34a" }}>{q.correctIndex === 0 ? "Verdadeiro" : "Falso"}</strong>
                    </p>
                  )}
                  {q.questionType === "dissertativa" && (
                    <p style={{ marginBottom: "0.5rem", fontSize: "0.85rem", opacity: 0.7 }}>{q.answerLines} linha{q.answerLines !== 1 ? "s" : ""} em branco no PDF</p>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: 99, background: TYPE_COLOR[q.questionType ?? "objetiva"] }}>
                      {TYPE_LABEL[q.questionType ?? "objetiva"]}
                    </span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: 99, background: DIFF_COLOR[q.difficulty ?? "medium"] }}>
                      {DIFF_LABEL[q.difficulty ?? "medium"]}
                    </span>
                    {q.thematicArea && <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>{q.thematicArea}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Importar Questões</h1>
        <Link href="/questions" className="btn btn-ghost">← Voltar</Link>
      </div>

      {/* Template reference */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>Referência de formato</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }} onClick={() => downloadTemplate("json")}>
              ↓ Baixar JSON
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }} onClick={() => handleCopy("json")}>
              {copied === "json" ? "✓ Copiado!" : "⎘ Copiar JSON"}
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }} onClick={() => downloadTemplate("csv")}>
              ↓ Baixar CSV
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }} onClick={() => handleCopy("csv")}>
              {copied === "csv" ? "✓ Copiado!" : "⎘ Copiar CSV"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {TEMPLATE_QUESTIONS.map((tq) => (
            <div key={tq.type} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "0.75rem", background: "#fafafa" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 99, background: TYPE_COLOR[tq.type] }}>
                  {tq.typeLabel}
                </span>
                <span style={{ fontSize: "0.78rem", opacity: 0.5 }}>{tq.note}</span>
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 500, margin: "0 0 0.25rem" }}>
                <MarkdownText text={tq.statement} />
              </div>
              <p style={{ fontSize: "0.78rem", color: "#16a34a", margin: 0 }}>{tq.preview}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>
          <div>
            <label className="form-label" htmlFor="template-json">JSON</label>
            <textarea
              id="template-json"
              className="form-textarea"
              rows={12}
              readOnly
              value={TEMPLATE_JSON}
              style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.72rem", whiteSpace: "pre", overflowX: "auto" }}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="template-csv">CSV</label>
            <textarea
              id="template-csv"
              className="form-textarea"
              rows={12}
              readOnly
              value={TEMPLATE_CSV}
              style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.72rem", whiteSpace: "pre", overflowX: "auto" }}
            />
          </div>
        </div>
      </div>

      {/* AI Prompt block */}
      <div style={{
        marginBottom: "1.5rem",
        border: "2px solid #dc2626",
        borderRadius: 10,
        background: "#fff5f5",
        padding: "1.25rem 1.5rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🤖</span>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#991b1b" }}>Prompt pronto para IA geradora de questões</span>
          </div>
          <button
            type="button"
            onClick={handlePromptCopy}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.35rem 0.9rem", borderRadius: 6, border: "1.5px solid #dc2626",
              background: promptCopied ? "#dc2626" : "#fff",
              color: promptCopied ? "#fff" : "#dc2626",
              fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {promptCopied ? "✓ Copiado!" : "⎘ Copiar prompt"}
          </button>
        </div>
        <p style={{ fontSize: "0.8rem", color: "#7f1d1d", marginBottom: "0.75rem", lineHeight: 1.5 }}>
          Copie o prompt abaixo, anexe o template JSON ou CSV baixado acima e envie para a IA de sua escolha.
        </p>
        <p style={{ fontSize: "0.78rem", color: "#7f1d1d", marginBottom: "0.75rem", lineHeight: 1.5 }}>
          HTML aceito no <code>statement</code>: {RICH_TEXT_ALLOWED_TAGS_LABEL}. Styles: {RICH_TEXT_ALLOWED_STYLE_LABEL}. {RICH_TEXT_BLOCKED_FEATURES_LABEL}.
        </p>
        <pre style={{
          margin: 0,
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: "0.78rem",
          lineHeight: 1.65,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "#1c1917",
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: 6,
          padding: "1rem",
          userSelect: "all",
        }}>
          {IMPORT_AI_PROMPT}
        </pre>
      </div>

      {/* Upload form */}
      <div className="card">
        <p style={{ marginBottom: "1.5rem", opacity: 0.75, fontSize: "0.9rem" }}>
          Importe a partir de um arquivo <strong>.json</strong> (exportado por este sistema) ou <strong>.csv</strong> (colunas: statement, question_type, difficulty, option_a…e, correct_index, thematic_area, answer_lines, explanation).
        </p>
        <p style={{ marginBottom: "1rem", opacity: 0.75, fontSize: "0.82rem" }}>
          O campo <code>statement</code> aceita HTML sanitizado. Tags: {RICH_TEXT_ALLOWED_TAGS_LABEL}. Atributos: {RICH_TEXT_ALLOWED_ATTRIBUTE_LABEL}. Styles: {RICH_TEXT_ALLOWED_STYLE_LABEL}.
        </p>
        <form onSubmit={handleFileSubmit}>
          <div className="form-group">
            <label className="form-label">Disciplina de destino *</label>
            <select name="disciplineId" className="form-select" required defaultValue={disciplines[0]?.id}>
              {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Arquivo (.json ou .csv) *</label>
            <input name="questionFile" type="file" accept=".json,.csv" className="form-input" style={{ padding: "0.4rem" }} required />
          </div>
          {error && <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Carregar e Visualizar</button>
          </div>
        </form>
      </div>
    </>
  );
}
