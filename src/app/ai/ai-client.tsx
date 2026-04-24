"use client";

import { useEffect, useState } from "react";
import type { Discipline, QuestionType } from "@/types";
import type { GenerationState } from "@/lib/actions/ai";
import type { GenerationResult } from "@/lib/ai/generate";
import { createQuestionAction } from "@/lib/actions/questions";
import { enqueueSingleAiGenerationAction } from "@/lib/actions/queue-actions";
import { useOllamaModels } from "@/lib/hooks/use-ollama-models";
import { AITracePanel } from "@/components/ai-trace-panel";
import { useToast } from "@/components/toast-provider";

const LETTERS = ["A", "B", "C", "D", "E"];

export function AIClient({ disciplines, initialTaskId }: { disciplines: Discipline[]; initialTaskId?: string }) {
  const [state, setState] = useState<GenerationState>({});
  const [topic, setTopic] = useState("");
  const [disciplineId, setDisciplineId] = useState(String(disciplines[0]?.id ?? ""));
  const [provider, setProvider] = useState("ollama");
  const [questionType, setQuestionType] = useState<QuestionType>("objetiva");
  const [ollamaModel, setOllamaModel] = useState("");
  const [pending, setPending] = useState(false);
  const [queuedTaskId, setQueuedTaskId] = useState<string | null>(initialTaskId ?? null);
  const { models: ollamaModels, loading: loadingModels, error: ollamaError } = useOllamaModels(provider === "ollama");
  const { pushToast, updateToast } = useToast();

  useEffect(() => {
    if (!initialTaskId) return;
    fetch(`/api/queue/${initialTaskId}/result`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.result) return;
        const result = data.result as GenerationResult;
        const payload = data.payload as { disciplineId: number; topic?: string };
        setState({ result: { ...result.question, disciplineId: payload.disciplineId }, trace: result.trace });
        setDisciplineId(String(payload.disciplineId));
        if (payload.topic) setTopic(payload.topic);
      })
      .catch(() => null);
  }, [initialTaskId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const toastId = pushToast({
      type: "info",
      title: "Questão enviada para a fila",
      description: "A geração segue em background. O resultado aparece em Ver quando concluir.",
    });

    try {
      const discipline = disciplines.find((d) => String(d.id) === disciplineId);
      const { taskId, error, isNew } = await enqueueSingleAiGenerationAction({
        disciplineName: discipline?.name ?? "Disciplina",
        disciplineId: Number(disciplineId),
        topic,
        provider,
        questionType,
        ollamaModel: provider === "ollama" && ollamaModel ? ollamaModel : undefined,
      });
      if (error) {
        setState((current) => ({ ...current, error }));
        updateToast(toastId, { type: "error", title: "Falha ao enfileirar", description: error });
        return;
      }
      setState((current) => ({ ...current, error: undefined }));
      setQueuedTaskId(taskId);
      updateToast(toastId, {
        type: "success",
        title: isNew ? "Tarefa criada" : "Tarefa já estava na fila",
        description: "Acompanhe no painel global de tarefas.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enfileirar geração.";
      setState((current) => ({ ...current, error: message }));
      updateToast(toastId, { type: "error", title: "Falha ao enfileirar", description: message });
    } finally {
      setPending(false);
    }
  }

  const result = state.result;

  return (
    <div style={{ display: "grid", gridTemplateColumns: result ? "1fr 1fr" : "1fr", gap: "1.5rem", alignItems: "start" }}>
      {/* ── Config form ───────────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem" }}>Configuração</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Disciplina *</label>
              <select
                className="form-select"
                value={disciplineId}
                onChange={(e) => setDisciplineId(e.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de questão</label>
              <select
                className="form-select"
                value={questionType}
                onChange={(e) => { setQuestionType(e.target.value as QuestionType); setState({}); }}
              >
                <option value="objetiva">Objetiva (A–E)</option>
                <option value="verdadeiro_falso">Verdadeiro ou Falso</option>
                <option value="dissertativa">Dissertativa</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Provedor IA</label>
            <select className="form-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="ollama">Qwen local (Ollama)</option>
              <option value="claude">Claude API</option>
              <option value="gemini">Gemini API</option>
            </select>
          </div>

          {provider === "ollama" && (
            <div className="form-group">
              <label className="form-label">Modelo Ollama</label>
              {loadingModels ? (
                <p style={{ fontSize: "0.82rem", opacity: 0.6 }}>Carregando modelos…</p>
              ) : ollamaModels.length > 0 ? (
                <select className="form-select" value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)}>
                  <option value="">— padrão (.env) —</option>
                  {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <div>
                  <input
                    className="form-input"
                    placeholder={`Ex: qwen2.5:14b`}
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                  />
                  {ollamaError && <p style={{ fontSize: "0.78rem", color: "#dc2626", marginTop: "0.25rem" }}>{ollamaError} — verifique se o Ollama está rodando</p>}
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Tema / Competência *</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder={
                questionType === "dissertativa"
                  ? "Ex: Normalização de banco de dados"
                  : questionType === "verdadeiro_falso"
                  ? "Ex: Conceitos de redes TCP/IP"
                  : "Ex: Complexidade de algoritmos de ordenação"
              }
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          {state.error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#991b1b" }}>
              {state.error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={pending} style={{ opacity: pending ? 0.7 : 1 }}>
            {pending ? "Enfileirando…" : "Gerar questão na fila"}
          </button>
          {queuedTaskId && (
            <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--muted)" }}>
              Tarefa {queuedTaskId} registrada. Use o painel de tarefas para cancelar ou abrir o resultado.
            </p>
          )}
        </form>
      </div>

      {/* ── Trace panel ──────────────────────────────────────────────────── */}
      {state.trace && (
        <div style={{ gridColumn: "1 / -1" }}>
          <AITracePanel trace={state.trace} liveEvents={[]} isStreaming={false} />
        </div>
      )}

      {/* ── Review + save form ────────────────────────────────────────────── */}
      {result && (
        <div className="card">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem" }}>Questão Gerada — Revise antes de salvar</h2>
          <form action={async (fd: FormData) => { await createQuestionAction(undefined, fd); }}>
            <input type="hidden" name="disciplineId" value={result.disciplineId} />
            <input type="hidden" name="source" value="ai" />
            <input type="hidden" name="questionType" value={result.questionType} />
            <input type="hidden" name="explanation" value={result.explanation ?? ""} />
            <input type="hidden" name="thematicArea" value={result.thematicArea ?? ""} />

            <div className="form-group">
              <label className="form-label">Enunciado</label>
              <textarea name="statement" className="form-textarea" rows={4} defaultValue={result.statement} required />
            </div>

            {/* Objetiva */}
            {result.questionType === "objetiva" && (
              <div className="form-group">
                <label className="form-label">Alternativas</label>
                <div className="options-list">
                  {result.options.map((opt, i) => (
                    <div key={i} className="option-row">
                      <div className="option-letter">{LETTERS[i]}</div>
                      <input name={`option${i}`} className="form-input" defaultValue={opt} required />
                      <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                        <input type="radio" name="correctIndex" value={i} defaultChecked={i === result.correctIndex} />
                        Correta
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verdadeiro ou Falso */}
            {result.questionType === "verdadeiro_falso" && (
              <div className="form-group">
                <label className="form-label">Resposta correta</label>
                <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.4rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                    <input type="radio" name="correctIndex" value="0" defaultChecked={result.correctIndex === 0} />
                    Verdadeiro
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                    <input type="radio" name="correctIndex" value="1" defaultChecked={result.correctIndex === 1} />
                    Falso
                  </label>
                </div>
              </div>
            )}

            {/* Dissertativa */}
            {result.questionType === "dissertativa" && (
              <div className="form-group">
                <label className="form-label">Linhas em branco para resposta</label>
                <input
                  type="number"
                  name="answerLines"
                  className="form-input"
                  defaultValue={result.answerLines || 6}
                  min={1}
                  max={30}
                  style={{ maxWidth: 100 }}
                />
              </div>
            )}

            {result.explanation && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#166534" }}>
                <strong>Justificativa:</strong> {result.explanation}
              </div>
            )}

            {result.thematicArea && (
              <div style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
                <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "0.15rem 0.5rem", borderRadius: 99, fontSize: "0.78rem" }}>
                  {result.thematicArea}
                </span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Dificuldade</label>
              <select name="difficulty" className="form-select" defaultValue="medium">
                <option value="easy">Fácil</option>
                <option value="medium">Médio</option>
                <option value="hard">Difícil</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary">Salvar no Banco</button>
          </form>
        </div>
      )}
    </div>
  );
}
