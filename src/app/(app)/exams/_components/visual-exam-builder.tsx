"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RichText } from "@/components/rich-text";
import { ExamPrintClient } from "@/components/print/exam-print-client";
import { createExamAction } from "@/lib/actions/exams";
import { buildDraftPrintPayload, type DraftPreviewQuestion } from "@/lib/exam/draft-preview";
import { useWorkspaceStore } from "@/lib/state/workspace-store";
import {
  DEFAULT_QUESTION_IMAGE_SCALE_PERCENT,
  MAX_QUESTION_IMAGE_SCALE_PERCENT,
  MIN_QUESTION_IMAGE_SCALE_PERCENT,
  normalizeQuestionImageScalePercent,
} from "@/lib/print/question-image-scale";
import type { Question, QuestionLayout, QuestionType } from "@/types";

const TYPE_LABEL: Record<QuestionType, string> = {
  objetiva: "Objetiva",
  verdadeiro_falso: "V/F",
  numerica: "Numérica",
  dissertativa: "Dissertativa",
};

const TYPE_LAYOUT_DEFAULT: Record<QuestionType, QuestionLayout> = {
  objetiva: "column",
  verdadeiro_falso: "column",
  numerica: "column",
  dissertativa: "full",
};

const GROUPS: Array<{ key: string; type: QuestionType; layout: QuestionLayout; label: string }> = [
  { key: "objetiva:column", type: "objetiva", layout: "column", label: "objetiva meia" },
  { key: "objetiva:full", type: "objetiva", layout: "full", label: "objetiva total" },
  { key: "verdadeiro_falso:column", type: "verdadeiro_falso", layout: "column", label: "V/F meia" },
  { key: "verdadeiro_falso:full", type: "verdadeiro_falso", layout: "full", label: "V/F total" },
  { key: "numerica:column", type: "numerica", layout: "column", label: "numérica meia" },
  { key: "numerica:full", type: "numerica", layout: "full", label: "numérica total" },
  { key: "dissertativa:column", type: "dissertativa", layout: "column", label: "dissertativa meia" },
  { key: "dissertativa:full", type: "dissertativa", layout: "full", label: "dissertativa total" },
];

const GROUP_INDEX = new Map(GROUPS.map((group, index) => [group.key, index]));

export interface VisualExamBuilderProps {
  disciplineId?: number;
  areas?: readonly string[];
  questions: readonly Question[];
  initialTitle?: string;
  initialInstitution?: string;
  initialInstructions?: string;
  initialQuantitySets?: string;
  initialAllowQuestionSplit?: string;
  initialDraftSeed: string;
  initialSelectedQuestionIds?: readonly number[];
  initialManualQuestionOrder?: readonly number[];
  initialLayoutOverrides?: Readonly<Record<number, QuestionLayout>>;
  initialImageScaleOverrides?: Readonly<Record<number, number>>;
  error?: string;
}

function questionGroupKey(question: Pick<Question, "questionType">, layout: QuestionLayout): string {
  return `${question.questionType}:${layout}`;
}

function groupForQuestion(question: Question, layoutOverrides: Readonly<Record<number, QuestionLayout>>): string {
  return questionGroupKey(question, layoutOverrides[question.id] ?? TYPE_LAYOUT_DEFAULT[question.questionType]);
}

function canonicalOrder(
  questions: readonly Question[],
  selectedIds: ReadonlySet<number>,
  layoutOverrides: Readonly<Record<number, QuestionLayout>>,
): number[] {
  return GROUPS.flatMap((group) =>
    questions
      .filter((question) => selectedIds.has(question.id) && groupForQuestion(question, layoutOverrides) === group.key)
      .map((question) => question.id),
  );
}

function normalizeOrder(
  questions: readonly Question[],
  selectedIds: ReadonlySet<number>,
  order: readonly number[],
  layoutOverrides: Readonly<Record<number, QuestionLayout>>,
): number[] {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const requested: number[] = [];
  for (const id of order) {
    const question = questionById.get(id);
    if (!question || !selectedIds.has(id) || requested.includes(id)) continue;
    requested.push(id);
  }
  const canonical = canonicalOrder(questions, selectedIds, layoutOverrides);
  const requestedByCanonicalGroup = GROUPS.flatMap((group) => requested.filter((id) => {
    const question = questionById.get(id);
    return question != null && groupForQuestion(question, layoutOverrides) === group.key;
  }));
  return requestedByCanonicalGroup.concat(canonical.filter((id) => !requested.includes(id)));
}

function insertAtGroupEnd(
  order: readonly number[],
  questionId: number,
  questionById: ReadonlyMap<number, Question>,
  layoutOverrides: Readonly<Record<number, QuestionLayout>>,
): number[] {
  const question = questionById.get(questionId);
  if (!question) return [...order, questionId];
  const key = groupForQuestion(question, layoutOverrides);
  const targetIndex = GROUP_INDEX.get(key) ?? 0;
  const withoutQuestion = order.filter((id) => id !== questionId);
  let lastInGroup = -1;
  let firstAfterGroup = withoutQuestion.length;
  for (let index = 0; index < withoutQuestion.length; index += 1) {
    const candidate = questionById.get(withoutQuestion[index]);
    if (!candidate) continue;
    const candidateIndex = GROUP_INDEX.get(groupForQuestion(candidate, layoutOverrides)) ?? 0;
    if (candidateIndex === targetIndex) lastInGroup = index;
    if (firstAfterGroup === withoutQuestion.length && candidateIndex > targetIndex) firstAfterGroup = index;
  }
  const insertIndex = lastInGroup >= 0 ? lastInGroup + 1 : firstAfterGroup;
  return [...withoutQuestion.slice(0, insertIndex), questionId, ...withoutQuestion.slice(insertIndex)];
}

function moveWithinGroup(
  order: readonly number[],
  questionId: number,
  direction: -1 | 1,
  questionById: ReadonlyMap<number, Question>,
  layoutOverrides: Readonly<Record<number, QuestionLayout>>,
): number[] {
  const question = questionById.get(questionId);
  if (!question) return [...order];
  const key = groupForQuestion(question, layoutOverrides);
  const groupPositions = order
    .map((id, index) => ({ id, index }))
    .filter(({ id }) => {
      const candidate = questionById.get(id);
      return candidate != null && groupForQuestion(candidate, layoutOverrides) === key;
    });
  const currentGroupIndex = groupPositions.findIndex(({ id }) => id === questionId);
  const targetGroupIndex = currentGroupIndex + direction;
  if (currentGroupIndex < 0 || targetGroupIndex < 0 || targetGroupIndex >= groupPositions.length) return [...order];
  const currentPosition = groupPositions[currentGroupIndex].index;
  const targetPosition = groupPositions[targetGroupIndex].index;
  const next = [...order];
  [next[currentPosition], next[targetPosition]] = [next[targetPosition], next[currentPosition]];
  return next;
}

function isBoundary(
  order: readonly number[],
  questionId: number,
  direction: -1 | 1,
  questionById: ReadonlyMap<number, Question>,
  layoutOverrides: Readonly<Record<number, QuestionLayout>>,
): boolean {
  return moveWithinGroup(order, questionId, direction, questionById, layoutOverrides).join(",") === order.join(",");
}

function questionToPreview(question: Question): DraftPreviewQuestion {
  return {
    id: question.id,
    statement: question.statement,
    imageUrl: question.imageUrl,
    options: question.options,
    correctIndex: question.correctIndex,
    questionType: question.questionType,
    answerLines: question.answerLines,
    correctAnswer: question.correctAnswer,
  };
}

export function calculateEmbeddedPreviewFit(
  pageWidth: number,
  availableWidth: number,
  previewHeight: number,
): { scale: number; height: number } {
  const safePageWidth = Number.isFinite(pageWidth) && pageWidth > 0 ? pageWidth : 0;
  const safeAvailableWidth = Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : 0;
  const safePreviewHeight = Number.isFinite(previewHeight) && previewHeight > 0 ? previewHeight : 0;
  const scale = safePageWidth > 0 ? Math.min(1, safeAvailableWidth / safePageWidth) : 1;
  return { scale, height: Math.ceil(safePreviewHeight * scale) };
}

export function VisualExamBuilder({
  disciplineId,
  areas = [],
  questions,
  initialTitle = "",
  initialInstitution = "UniFil - Centro Universitário Filadélfia",
  initialInstructions = "Leia atentamente cada questão e assinale apenas uma alternativa quando aplicável.",
  initialQuantitySets = "2",
  initialAllowQuestionSplit = "",
  initialDraftSeed,
  initialSelectedQuestionIds,
  initialManualQuestionOrder,
  initialLayoutOverrides,
  initialImageScaleOverrides,
  error,
}: VisualExamBuilderProps) {
  const questionById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
  const initialSelected = useMemo(
    () => new Set((initialSelectedQuestionIds ?? questions.map((question) => question.id)).filter((id) => questionById.has(id))),
    [initialSelectedQuestionIds, questionById, questions],
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(initialSelected));
  const [layoutOverrides, setLayoutOverrides] = useState<Record<number, QuestionLayout>>(() => ({ ...(initialLayoutOverrides ?? {}) }));
  const [order, setOrder] = useState<number[]>(() => normalizeOrder(
    questions,
    initialSelected,
    initialManualQuestionOrder ?? [],
    initialLayoutOverrides ?? {},
  ));
  const [imageScaleOverrides, setImageScaleOverrides] = useState<Record<number, number>>(() => ({ ...(initialImageScaleOverrides ?? {}) }));
  const [title, setTitle] = useState(initialTitle);
  const [institution, setInstitution] = useState(initialInstitution);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [quantitySets, setQuantitySets] = useState(initialQuantitySets);
  const [allowQuestionSplit, setAllowQuestionSplit] = useState(initialAllowQuestionSplit === "1");
  const [activeSetIndex, setActiveSetIndex] = useState(0);
  const previewFitRef = useRef<HTMLDivElement | null>(null);
  const updateExam = useWorkspaceStore((state) => state.updateExam);

  const normalizedOrder = useMemo(
    () => normalizeOrder(questions, selectedIds, order, layoutOverrides),
    [layoutOverrides, order, questions, selectedIds],
  );
  const selectedQuestions = useMemo(
    () => normalizedOrder.map((id) => questionById.get(id)).filter((question): question is Question => question != null),
    [normalizedOrder, questionById],
  );
  const previewQuestions = useMemo(() => questions.map(questionToPreview), [questions]);
  const quantityByType = useMemo(() => {
    const counts: Record<QuestionType, number> = { objetiva: 0, verdadeiro_falso: 0, numerica: 0, dissertativa: 0 };
    for (const question of selectedQuestions) counts[question.questionType] += 1;
    return counts;
  }, [selectedQuestions]);
  const questionLayouts = TYPE_LAYOUT_DEFAULT;
  const previewPayload = useMemo(
    () => buildDraftPrintPayload(previewQuestions, {
      title,
      institution,
      instructions,
      quantitySets: Number(quantitySets) || 1,
      allowQuestionSplit,
      questionLayouts,
      selectedQuestionIds: [...selectedIds],
      manualQuestionOrder: normalizedOrder,
      layoutOverrides,
      imageScaleOverrides,
      draftSeed: initialDraftSeed,
    }),
    [allowQuestionSplit, imageScaleOverrides, initialDraftSeed, institution, instructions, layoutOverrides, normalizedOrder, previewQuestions, quantitySets, questionLayouts, selectedIds, title],
  );
  const activePreviewSetIndex = Math.min(activeSetIndex, Math.max(0, previewPayload.sets.length - 1));

  useEffect(() => {
    updateExam({
      title,
      institution,
      quantitySets,
      numObjetivas: String(quantityByType.objetiva),
      numVF: String(quantityByType.verdadeiro_falso),
      numNumericas: String(quantityByType.numerica),
      numDissertativas: String(quantityByType.dissertativa),
      layoutObjetiva: "column",
      layoutVF: "column",
      layoutNumerica: "column",
      layoutDissertativa: "full",
      allowQuestionSplit,
      compactQuestionOrder: true,
      draftSeed: initialDraftSeed,
      selectedQuestionIds: [...selectedIds],
      manualQuestionOrder: normalizedOrder,
      layoutOverrides,
      imageScaleOverrides,
    });
  }, [allowQuestionSplit, imageScaleOverrides, initialDraftSeed, institution, layoutOverrides, normalizedOrder, quantityByType, quantitySets, selectedIds, title, updateExam]);

  function toggleSelection(id: number): void {
    const question = questionById.get(id);
    if (!question) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        setOrder((currentOrder) => currentOrder.filter((currentId) => currentId !== id));
        setImageScaleOverrides((currentOverrides) => {
          if (!(id in currentOverrides)) return currentOverrides;
          const nextOverrides = { ...currentOverrides };
          delete nextOverrides[id];
          return nextOverrides;
        });
      } else {
        next.add(id);
        setOrder((currentOrder) => insertAtGroupEnd(currentOrder, id, questionById, layoutOverrides));
      }
      return next;
    });
  }

  function toggleLayout(id: number): void {
    const question = questionById.get(id);
    if (!question || !selectedIds.has(id)) return;
    const nextLayout: QuestionLayout = (layoutOverrides[id] ?? TYPE_LAYOUT_DEFAULT[question.questionType]) === "full" ? "column" : "full";
    const nextOverrides = { ...layoutOverrides, [id]: nextLayout };
    setLayoutOverrides(nextOverrides);
    setOrder((currentOrder) => insertAtGroupEnd(currentOrder, id, questionById, nextOverrides));
  }

  function updateImageScale(id: number, rawValue: string): void {
    const percent = normalizeQuestionImageScalePercent(Number(rawValue));
    setImageScaleOverrides((current) => {
      if (percent === DEFAULT_QUESTION_IMAGE_SCALE_PERCENT) {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      }
      return current[id] === percent ? current : { ...current, [id]: percent };
    });
  }

  function handlePreviewScaleChange(next: Readonly<Record<number, number>>): void {
    setImageScaleOverrides({ ...next });
  }

  useEffect(() => {
    const fitRoot = previewFitRef.current;
    const canvas = fitRoot?.parentElement;
    if (!fitRoot || !canvas) return;

    const updateFit = () => {
      const preview = fitRoot.querySelector<HTMLElement>(".exam-print-preview");
      const page = preview?.querySelector<HTMLElement>(".exam-print-page");
      if (!preview || !page) return;

      // The preview-only transform is deliberately applied after ExamPrintClient's
      // hidden measurement tree. A4 dimensions therefore remain unchanged for
      // DOM measurement, pagination, standalone preview, and print/PDF output.
      const pageWidth = page.offsetWidth || page.getBoundingClientRect().width;
      const availableWidth = Math.max(0, canvas.clientWidth - 24);
      const fit = calculateEmbeddedPreviewFit(pageWidth, availableWidth, preview.scrollHeight);
      preview.style.setProperty("--embedded-fit-scale", String(fit.scale));
      fitRoot.style.height = `${fit.height}px`;
    };

    updateFit();
    if (typeof ResizeObserver === "undefined") return;
    const resizeObserver = new ResizeObserver(updateFit);
    resizeObserver.observe(canvas);
    resizeObserver.observe(fitRoot);
    const mutationObserver = typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(updateFit);
    mutationObserver?.observe(fitRoot, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
    };
  }, [activePreviewSetIndex, previewPayload.sets.length]);

  return (
    <form action={createExamAction} className="visual-exam-builder" data-testid="visual-exam-builder">
      <input type="hidden" name="visualBuilder" value="1" />
      <input type="hidden" name="disciplineId" value={disciplineId ?? ""} />
      <input type="hidden" name="draftSeed" value={initialDraftSeed} />
      <input type="hidden" name="quantitySets" value={quantitySets} />
      <input type="hidden" name="allowQuestionSplit" value={allowQuestionSplit ? "1" : "0"} />
      <input type="hidden" name="compactQuestionOrder" value="1" />
      <input type="hidden" name="layoutObjetiva" value="column" />
      <input type="hidden" name="layoutVF" value="column" />
      <input type="hidden" name="layoutNumerica" value="column" />
      <input type="hidden" name="layoutDissertativa" value="full" />
      <input type="hidden" name="numObjetivas" value={quantityByType.objetiva} />
      <input type="hidden" name="numVF" value={quantityByType.verdadeiro_falso} />
      <input type="hidden" name="numNumericas" value={quantityByType.numerica} />
      <input type="hidden" name="numDissertativas" value={quantityByType.dissertativa} />
      {areas.map((area) => <input key={area} type="hidden" name="area" value={area} />)}
      {normalizedOrder.map((id) => <input key={`selected-${id}`} type="hidden" name="questionIds" value={id} />)}
      {normalizedOrder.map((id) => <input key={`order-${id}`} type="hidden" name="manualQuestionOrder" value={id} />)}
      {normalizedOrder.map((id) => (
        <input key={`layout-${id}`} type="hidden" name={`layoutOverride-${id}`} value={layoutOverrides[id] ?? TYPE_LAYOUT_DEFAULT[questionById.get(id)?.questionType ?? "objetiva"]} />
      ))}
      {selectedQuestions.filter((question) => question.imageUrl && imageScaleOverrides[question.id] !== undefined).map((question) => (
        <input key={`scale-${question.id}`} type="hidden" name={`imageScale-${question.id}`} value={imageScaleOverrides[question.id]} />
      ))}

      <div className="visual-exam-builder-grid">
        <section className="visual-exam-editor card">
          <div className="visual-exam-builder-heading">
            <div>
              <p className="eyebrow">Editor visual</p>
              <h2>Nova prova</h2>
              <p className="form-help">Escolha questões auditadas, organize a ordem e confira o A4 antes de gerar.</p>
            </div>
            <span className="badge">{selectedQuestions.length} selecionada(s)</span>
          </div>

          {error && <div className="form-error" role="alert">Erro: {error}</div>}

          <div className="visual-exam-metadata">
            <label className="form-group">
              <span className="form-label">Título *</span>
              <input name="title" className="form-input" value={title} onChange={(event) => setTitle(event.currentTarget.value)} required />
            </label>
            <label className="form-group">
              <span className="form-label">Instituição</span>
              <input name="institution" className="form-input" value={institution} onChange={(event) => setInstitution(event.currentTarget.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Instruções da primeira página</span>
              <textarea name="instructions" className="form-textarea" value={instructions} onChange={(event) => setInstructions(event.currentTarget.value)} rows={3} required />
            </label>
            <label className="form-group visual-exam-sets-input">
              <span className="form-label">Sets</span>
              <input className="form-input" type="number" min={1} max={8} value={quantitySets} onChange={(event) => setQuantitySets(event.currentTarget.value)} />
            </label>
            <label className="exam-editor-checkbox">
              <input type="checkbox" checked={allowQuestionSplit} onChange={(event) => setAllowQuestionSplit(event.currentTarget.checked)} />
              <span><strong>Permitir quebra de objetivas longas</strong><small>A continuação sempre começa na próxima página.</small></span>
            </label>
          </div>

          <section className="visual-exam-pool" aria-labelledby="visual-exam-pool-heading">
            <div className="visual-exam-section-heading">
              <div>
                <h3 id="visual-exam-pool-heading">Banco auditado</h3>
                <p className="form-help">{questions.length} disponível(is) · marque as questões que entram na prova.</p>
              </div>
              <span className="badge">{selectedQuestions.length} selecionada(s)</span>
            </div>
            <div className="visual-exam-pool-list">
              {questions.map((question) => (
                <label className={`visual-exam-pool-row${selectedIds.has(question.id) ? " is-selected" : ""}`} key={question.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(question.id)}
                    onChange={() => toggleSelection(question.id)}
                    aria-label={`Selecionar questão ${question.id}`}
                  />
                  <span className="visual-exam-pool-copy">
                    <strong>Questão {question.id} · {TYPE_LABEL[question.questionType]}</strong>
                    <span className="visual-exam-pool-statement"><RichText html={question.statement} /></span>
                    {question.imageUrl && <span className="visual-exam-image-tag">Imagem</span>}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="visual-exam-order" aria-labelledby="visual-exam-order-heading">
            <div className="visual-exam-section-heading">
              <div>
                <h3 id="visual-exam-order-heading">Ordem, largura e imagens</h3>
                <p className="form-help">Subir e descer atua somente dentro do mesmo tipo e largura.</p>
              </div>
              <span className="badge">Ordem canônica</span>
            </div>
            <div className="visual-exam-order-list">
              {GROUPS.map((group) => {
                const groupQuestions = normalizedOrder
                  .map((id) => questionById.get(id))
                  .filter((question): question is Question => question != null && groupForQuestion(question, layoutOverrides) === group.key);
                return (
                  <section className="visual-exam-order-group" key={group.key} aria-labelledby={`group-heading-${group.key}`}>
                    <h4 id={`group-heading-${group.key}`}>{group.label}</h4>
                    {groupQuestions.length === 0 ? (
                      <p className="visual-exam-empty-group">Nenhuma selecionada</p>
                    ) : (
                      <ol>
                        {groupQuestions.map((question) => {
                          const scale = normalizeQuestionImageScalePercent(imageScaleOverrides[question.id]);
                          const atTop = isBoundary(normalizedOrder, question.id, -1, questionById, layoutOverrides);
                          const atBottom = isBoundary(normalizedOrder, question.id, 1, questionById, layoutOverrides);
                          return (
                            <li key={question.id} className="visual-exam-order-row">
                              <div className="visual-exam-order-copy">
                                <strong>Questão {question.id}</strong>
                                <span>{TYPE_LABEL[question.questionType]} · {group.layout === "column" ? "meia página" : "largura total"}</span>
                              </div>
                              <div className="visual-exam-order-actions">
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOrder((current) => moveWithinGroup(current, question.id, -1, questionById, layoutOverrides))} disabled={atTop} aria-label={`Mover questão ${question.id} para cima`}>↑</button>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOrder((current) => moveWithinGroup(current, question.id, 1, questionById, layoutOverrides))} disabled={atBottom} aria-label={`Mover questão ${question.id} para baixo`}>↓</button>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleLayout(question.id)} aria-label={`Alternar largura da questão ${question.id}`}>{group.layout === "column" ? "Total" : "Meia"}</button>
                              </div>
                              {question.imageUrl && (
                                <label className="visual-exam-image-scale">
                                  <span>Imagem <output>{scale}%</output></span>
                                  <input
                                    type="range"
                                    min={MIN_QUESTION_IMAGE_SCALE_PERCENT}
                                    max={MAX_QUESTION_IMAGE_SCALE_PERCENT}
                                    step={1}
                                    value={scale}
                                    onChange={(event) => updateImageScale(question.id, event.currentTarget.value)}
                                    aria-label={`Escala da imagem da questão ${question.id}`}
                                  />
                                </label>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </section>
                );
              })}
            </div>
          </section>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!disciplineId || selectedQuestions.length === 0 || !title.trim()}>
              Gerar prova
            </button>
            <span className="form-help">{selectedQuestions.length} questão(ões) · {quantitySets || 1} set(s)</span>
          </div>
        </section>

        <aside className="visual-exam-preview-panel" aria-label="Pré-visualização A4">
          <div className="visual-exam-preview-heading">
            <div>
              <p className="eyebrow">Preview permanente</p>
              <h2>Formato A4</h2>
            </div>
            <div className="visual-exam-set-tabs" role="group" aria-label="Sets da pré-visualização">
              {previewPayload.sets.map((set, index) => (
                <button
                  type="button"
                  aria-pressed={activePreviewSetIndex === index}
                  className={`btn btn-sm ${activePreviewSetIndex === index ? "btn-primary" : "btn-ghost"}`}
                  key={set.id}
                  onClick={() => setActiveSetIndex(index)}
                >
                  Set {set.label}
                </button>
              ))}
            </div>
          </div>
          <div className="visual-exam-preview-canvas">
            {previewPayload.sets.length > 0 ? (
              <div className="visual-exam-preview-fit" ref={previewFitRef}>
                <ExamPrintClient
                  payload={previewPayload}
                  mode="set"
                  setId={previewPayload.sets[activePreviewSetIndex]?.id}
                  embedded
                  imageScaleOverrides={imageScaleOverrides}
                  onImageScaleChange={handlePreviewScaleChange}
                />
              </div>
            ) : (
              <div className="visual-exam-preview-empty">Selecione ao menos uma questão para montar o preview.</div>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}
