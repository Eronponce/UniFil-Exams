"use client";

import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { RichText } from "@/components/rich-text";
import { ExamPrintClient } from "@/components/print/exam-print-client";
import { createExamAction, saveVisualExamVersionAction } from "@/lib/actions/exams";
import { buildDraftPrintPayload, type DraftPreviewQuestion } from "@/lib/exam/draft-preview";
import {
  ANSWER_KEY_DEFAULT_WIDTH_PT,
  ANSWER_KEY_MAX_WIDTH_PT,
  ANSWER_KEY_MIN_WIDTH_PT,
  ANSWER_KEY_WIDTH_STEP_PT,
  clampAnswerKeyWidth,
  getAnswerKeyWidthPercent,
} from "@/lib/pdf/answer-key-layout";
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

const TYPE_CONTROLS: Array<{ type: QuestionType; name: string; label: string }> = [
  { type: "objetiva", name: "numObjetivas", label: "Objetivas" },
  { type: "verdadeiro_falso", name: "numVF", label: "Verdadeiro/Falso" },
  { type: "numerica", name: "numNumericas", label: "Numéricas" },
  { type: "dissertativa", name: "numDissertativas", label: "Dissertativas" },
];

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
const TYPE_INDEX = new Map(TYPE_CONTROLS.map((control, index) => [control.type, index]));

type PoolStatusFilter = "all" | "selected" | "unselected" | "excluded";
type EditorTab = "bank" | "order" | "config";

const EDITOR_TABS: EditorTab[] = ["bank", "order", "config"];

const POOL_STATUS_OPTIONS: Array<{ value: PoolStatusFilter; label: string }> = [
  { value: "all", label: "Todas as situações" },
  { value: "selected", label: "Na prova" },
  { value: "unselected", label: "Não selecionadas" },
  { value: "excluded", label: "Fora desta prova" },
];

function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function questionSearchText(question: Question): string {
  return normalizeSearchText(`${question.id} ${question.statement.replace(/<[^>]*>/g, " ")}`);
}

export interface VisualExamBuilderProps {
  mode?: "create" | "edit";
  examId?: number;
  disciplineId?: number;
  disciplineName?: string;
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
  initialAnswerKeyWidthPt?: number;
  initialAnswerKeyUrl?: string | null;
  /** Discipline/area picker rendered inside the sticky bar (create mode). */
  filter?: ReactNode;
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
  mode = "create",
  examId,
  disciplineId,
  disciplineName,
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
  initialAnswerKeyWidthPt = ANSWER_KEY_DEFAULT_WIDTH_PT,
  initialAnswerKeyUrl = null,
  filter,
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
  const [answerKeyWidthPt, setAnswerKeyWidthPt] = useState(() => clampAnswerKeyWidth(initialAnswerKeyWidthPt));
  const [answerKeyPreviewUrl, setAnswerKeyPreviewUrl] = useState<string | null>(initialAnswerKeyUrl);
  const [answerKeyFilename, setAnswerKeyFilename] = useState<string | null>(initialAnswerKeyUrl ? "Gabarito atual" : null);
  const [answerKeyError, setAnswerKeyError] = useState<string | null>(null);
  const [removeAnswerKey, setRemoveAnswerKey] = useState(false);
  const [activeSetIndex, setActiveSetIndex] = useState(0);
  const [excludedIds, setExcludedIds] = useState<Set<number>>(() => new Set());
  const [poolType, setPoolType] = useState<QuestionType | "all">("all");
  const [poolStatus, setPoolStatus] = useState<PoolStatusFilter>("all");
  const [poolQuery, setPoolQuery] = useState("");
  const [activeTab, setActiveTab] = useState<EditorTab>("bank");
  const builderRef = useRef<HTMLFormElement | null>(null);
  const barRef = useRef<HTMLElement | null>(null);
  const quantityBaselineRef = useRef<{
    type: QuestionType;
    selectedIds: ReadonlySet<number>;
    order: readonly number[];
    imageScaleOverrides: Readonly<Record<number, number>>;
  } | null>(null);
  const previewFitRef = useRef<HTMLDivElement | null>(null);
  const answerKeyInputRef = useRef<HTMLInputElement | null>(null);
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
  const availableByType = useMemo(() => {
    const counts: Record<QuestionType, number> = { objetiva: 0, verdadeiro_falso: 0, numerica: 0, dissertativa: 0 };
    for (const question of questions) if (!excludedIds.has(question.id)) counts[question.questionType] += 1;
    return counts;
  }, [excludedIds, questions]);
  const totalByType = useMemo(() => {
    const counts: Record<QuestionType, number> = { objetiva: 0, verdadeiro_falso: 0, numerica: 0, dissertativa: 0 };
    for (const question of questions) counts[question.questionType] += 1;
    return counts;
  }, [questions]);
  const poolQuestions = useMemo(
    () => questions
      .map((question) => ({ question, searchText: questionSearchText(question) }))
      .sort((left, right) => (TYPE_INDEX.get(left.question.questionType) ?? 0) - (TYPE_INDEX.get(right.question.questionType) ?? 0)),
    [questions],
  );
  const normalizedPoolQuery = normalizeSearchText(poolQuery.trim());
  const poolFiltersActive = poolType !== "all" || poolStatus !== "all" || normalizedPoolQuery !== "";
  const visiblePoolQuestions = poolQuestions
    .filter(({ question, searchText }) => {
      if (poolType !== "all" && question.questionType !== poolType) return false;
      if (poolStatus === "selected" && !selectedIds.has(question.id)) return false;
      if (poolStatus === "unselected" && (selectedIds.has(question.id) || excludedIds.has(question.id))) return false;
      if (poolStatus === "excluded" && !excludedIds.has(question.id)) return false;
      return normalizedPoolQuery === "" || searchText.includes(normalizedPoolQuery);
    })
    .map(({ question }) => question);
  const excludedByType = useMemo(() => {
    const counts: Record<QuestionType, number> = { objetiva: 0, verdadeiro_falso: 0, numerica: 0, dissertativa: 0 };
    for (const question of questions) if (excludedIds.has(question.id)) counts[question.questionType] += 1;
    return counts;
  }, [excludedIds, questions]);
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
      answerKeyWidthPt,
      answerKeyUrl: answerKeyPreviewUrl,
    }),
    [allowQuestionSplit, answerKeyPreviewUrl, answerKeyWidthPt, imageScaleOverrides, initialDraftSeed, institution, instructions, layoutOverrides, normalizedOrder, previewQuestions, quantitySets, questionLayouts, selectedIds, title],
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

  useEffect(() => () => {
    if (answerKeyPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(answerKeyPreviewUrl);
  }, [answerKeyPreviewUrl]);

  function selectAnswerKeyFile(file: File | undefined): void {
    if (!file) return;
    if (file.size > 9 * 1024 * 1024) {
      setAnswerKeyError("O gabarito deve ter no máximo 9 MB.");
      if (answerKeyInputRef.current) answerKeyInputRef.current.value = "";
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["png", "jpg", "jpeg"].includes(extension)) {
      setAnswerKeyError("Use uma imagem PNG ou JPG.");
      if (answerKeyInputRef.current) answerKeyInputRef.current.value = "";
      return;
    }
    setAnswerKeyError(null);
    setAnswerKeyFilename(file.name);
    setAnswerKeyPreviewUrl(URL.createObjectURL(file));
    setRemoveAnswerKey(false);
  }

  function removeAnswerKeyFile(): void {
    if (answerKeyInputRef.current) answerKeyInputRef.current.value = "";
    setAnswerKeyFilename(null);
    setAnswerKeyError(null);
    setAnswerKeyPreviewUrl(null);
    setRemoveAnswerKey(true);
  }

  function deselect(id: number): void {
    setSelectedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setOrder((currentOrder) => currentOrder.filter((currentId) => currentId !== id));
    setImageScaleOverrides((currentOverrides) => {
      if (!(id in currentOverrides)) return currentOverrides;
      const nextOverrides = { ...currentOverrides };
      delete nextOverrides[id];
      return nextOverrides;
    });
  }

  function toggleSelection(id: number): void {
    if (!questionById.has(id) || excludedIds.has(id)) return;
    if (selectedIds.has(id)) {
      deselect(id);
      return;
    }
    setSelectedIds((current) => new Set(current).add(id));
    setOrder((currentOrder) => insertAtGroupEnd(currentOrder, id, questionById, layoutOverrides));
  }

  function toggleExclusion(id: number): void {
    if (!questionById.has(id)) return;
    const next = new Set(excludedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      deselect(id);
    }
    setExcludedIds(next);
  }

  function clearPoolFilters(): void {
    setPoolType("all");
    setPoolStatus("all");
    setPoolQuery("");
  }

  function preventImplicitSubmit(event: KeyboardEvent<HTMLFormElement>): void {
    // Enter in a text/number field would create or save the whole exam; only
    // the explicit submit button should do that.
    if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type !== "file") event.preventDefault();
  }

  function openInvalidField(event: FormEvent<HTMLFormElement>): void {
    // Required fields living in a hidden tab cannot show the browser bubble;
    // reveal their tab so the empty field is visible.
    if (event.target instanceof HTMLElement && event.target.closest("#visual-exam-panel-config")) setActiveTab("config");
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = EDITOR_TABS[(EDITOR_TABS.indexOf(activeTab) + direction + EDITOR_TABS.length) % EDITOR_TABS.length];
    setActiveTab(next);
    document.getElementById(`visual-exam-tab-${next}`)?.focus();
  }

  function beginQuantityEdit(type: QuestionType): void {
    quantityBaselineRef.current = { type, selectedIds, order: normalizedOrder, imageScaleOverrides };
  }

  function setTypeQuantity(type: QuestionType, rawValue: string): void {
    const parsed = Number.parseInt(rawValue, 10);
    const target = Math.min(
      Math.max(Number.isFinite(parsed) ? parsed : 0, 0),
      availableByType[type],
    );
    // Typing "10" over "11" passes through "1"; resolving every keystroke
    // against the focus-time selection keeps intermediate values from
    // discarding manual picks and refilling from bank order.
    const baseline = quantityBaselineRef.current?.type === type
      ? quantityBaselineRef.current
      : { selectedIds, order: normalizedOrder, imageScaleOverrides };
    const selectedOfType = baseline.order.filter((id) => questionById.get(id)?.questionType === type);
    const idsToRemove = selectedOfType.slice(target);
    const idsToAdd = questions
      .filter((question) => question.questionType === type && !baseline.selectedIds.has(question.id) && !excludedIds.has(question.id))
      .slice(0, Math.max(0, target - selectedOfType.length))
      .map((question) => question.id);

    const nextSelected = new Set(baseline.selectedIds);
    for (const id of idsToRemove) nextSelected.delete(id);
    for (const id of idsToAdd) nextSelected.add(id);
    let nextOrder = baseline.order.filter((id) => nextSelected.has(id));
    for (const id of idsToAdd) nextOrder = insertAtGroupEnd(nextOrder, id, questionById, layoutOverrides);
    const nextOverrides = { ...baseline.imageScaleOverrides };
    for (const id of idsToRemove) delete nextOverrides[id];

    setSelectedIds(nextSelected);
    setOrder(nextOrder);
    setImageScaleOverrides(nextOverrides);
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
    const bar = barRef.current;
    const root = builderRef.current;
    if (!bar || !root || typeof ResizeObserver === "undefined") return;
    // Sticky panels sit below the bar; its height changes with wrapping.
    const update = () => root.style.setProperty("--exam-bar-h", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

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

  const submitLabel = mode === "edit" ? "Salvar nova versão" : "Gerar prova";
  const canSubmit = Boolean(disciplineId) && selectedQuestions.length > 0 && title.trim() !== "";
  const orderGroups = GROUPS
    .map((group) => ({
      group,
      questions: normalizedOrder
        .map((id) => questionById.get(id))
        .filter((question): question is Question => question != null && groupForQuestion(question, layoutOverrides) === group.key),
    }))
    .filter((entry) => entry.questions.length > 0);
  const tabLabels: Record<EditorTab, ReactNode> = {
    bank: <>Banco <span className="visual-exam-tab-count">{questions.length - excludedIds.size}</span></>,
    order: <>Na prova <span className="visual-exam-tab-count">{selectedQuestions.length}</span></>,
    config: <><Icon name="settings" size={14} /> Configurar</>,
  };

  return (
    <form
      ref={builderRef}
      action={mode === "edit" ? saveVisualExamVersionAction : createExamAction}
      className="visual-exam-builder"
      data-testid="visual-exam-builder"
      onKeyDown={preventImplicitSubmit}
      onInvalidCapture={openInvalidField}
    >
      <input type="hidden" name="visualBuilder" value="1" />
      {mode === "edit" && <input type="hidden" name="examId" value={examId ?? ""} />}
      {mode === "edit" && <input type="hidden" name="removeAnswerKey" value={removeAnswerKey ? "1" : "0"} />}
      <input type="hidden" name="disciplineId" value={disciplineId ?? ""} />
      <input type="hidden" name="draftSeed" value={initialDraftSeed} />
      <input type="hidden" name="allowQuestionSplit" value={allowQuestionSplit ? "1" : "0"} />
      <input type="hidden" name="compactQuestionOrder" value="1" />
      <input type="hidden" name="layoutObjetiva" value="column" />
      <input type="hidden" name="layoutVF" value="column" />
      <input type="hidden" name="layoutNumerica" value="column" />
      <input type="hidden" name="layoutDissertativa" value="full" />
      {areas.map((area) => <input key={area} type="hidden" name="area" value={area} />)}
      {normalizedOrder.map((id) => <input key={`selected-${id}`} type="hidden" name="questionIds" value={id} />)}
      {normalizedOrder.map((id) => <input key={`order-${id}`} type="hidden" name="manualQuestionOrder" value={id} />)}
      {normalizedOrder.map((id) => (
        <input key={`layout-${id}`} type="hidden" name={`layoutOverride-${id}`} value={layoutOverrides[id] ?? TYPE_LAYOUT_DEFAULT[questionById.get(id)?.questionType ?? "objetiva"]} />
      ))}
      {selectedQuestions.filter((question) => question.imageUrl).map((question) => (
        <input key={`scale-${question.id}`} type="hidden" name={`imageScale-${question.id}`} value={normalizeQuestionImageScalePercent(imageScaleOverrides[question.id])} />
      ))}

      <section ref={barRef} className="visual-exam-bar card" aria-labelledby="visual-exam-bar-heading">
        <div className="visual-exam-bar-row">
          <strong id="visual-exam-bar-heading" className="visual-exam-bar-heading" role="heading" aria-level={2}>
            {mode === "edit" ? "Editar prova" : "Nova prova"}
          </strong>
          <label className="visual-exam-bar-title">
            <span className="sr-only">Título *</span>
            <input name="title" className="form-input" value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="Título da prova *" required />
          </label>
          {filter ?? (
            <span className="visual-exam-bar-context">
              <strong>{disciplineName ?? `Disciplina ${disciplineId ?? ""}`}</strong>
              <span>{areas.length > 0 ? areas.join(", ") : "todas as áreas"}</span>
            </span>
          )}
          <label className="visual-exam-bar-sets">
            <span>Sets</span>
            <input name="quantitySets" className="form-input" type="number" min={1} max={8} value={quantitySets} onChange={(event) => setQuantitySets(event.currentTarget.value)} />
          </label>
        </div>

        <div className="visual-exam-bar-row">
          <div className="visual-exam-steppers" role="group" aria-label="Quantidade por tipo">
            {TYPE_CONTROLS.filter(({ type }) => totalByType[type] > 0).map(({ type, name, label }) => (
              <div className="visual-exam-stepper" key={type}>
                <span className="visual-exam-stepper-label">{label}</span>
                <span className="visual-exam-stepper-control">
                  <button type="button" onClick={() => setTypeQuantity(type, String(quantityByType[type] - 1))} disabled={quantityByType[type] === 0} aria-label={`Diminuir ${label}`}>−</button>
                  <input
                    name={name}
                    type="number"
                    min={0}
                    max={availableByType[type]}
                    value={quantityByType[type]}
                    onFocus={() => beginQuantityEdit(type)}
                    onBlur={() => { quantityBaselineRef.current = null; }}
                    onChange={(event) => setTypeQuantity(type, event.currentTarget.value)}
                    aria-label={`Quantidade de ${label}`}
                  />
                  <button type="button" onClick={() => setTypeQuantity(type, String(quantityByType[type] + 1))} disabled={quantityByType[type] >= availableByType[type]} aria-label={`Aumentar ${label}`}>+</button>
                </span>
                <small>
                  de {availableByType[type]}
                  {excludedByType[type] > 0 && ` · ${excludedByType[type]} fora`}
                </small>
              </div>
            ))}
          </div>
          <div className="visual-exam-bar-actions">
            <span className="visual-exam-bar-summary">{selectedQuestions.length} questão(ões) · {quantitySets || 1} set(s)</span>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>{submitLabel}</button>
          </div>
        </div>
        {error && <div className="form-error" role="alert">Erro: {error}</div>}
      </section>

      <div className="visual-exam-workspace">
        <section className="visual-exam-editor card" aria-label="Questões da prova">
          <div className="visual-exam-tabs" role="tablist" aria-label="Painel da montagem">
            {EDITOR_TABS.map((tab) => (
              <button
                key={tab}
                id={`visual-exam-tab-${tab}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`visual-exam-panel-${tab}`}
                tabIndex={activeTab === tab ? 0 : -1}
                className={`visual-exam-tab${activeTab === tab ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab)}
                onKeyDown={handleTabKeyDown}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          <div id="visual-exam-panel-bank" role="tabpanel" aria-labelledby="visual-exam-tab-bank" className="visual-exam-panel" hidden={activeTab !== "bank"}>
            <div className="visual-exam-pool-toolbar">
              <input
                type="search"
                className="form-input"
                value={poolQuery}
                onChange={(event) => setPoolQuery(event.currentTarget.value)}
                placeholder="Buscar por número ou enunciado"
                aria-label="Buscar no banco auditado"
              />
              <select className="form-select" value={poolStatus} onChange={(event) => setPoolStatus(event.currentTarget.value as PoolStatusFilter)} aria-label="Filtrar por situação">
                {POOL_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <div className="visual-exam-pool-type-filter" role="group" aria-label="Filtrar por tipo">
                <button type="button" className={`btn btn-sm ${poolType === "all" ? "btn-primary" : "btn-ghost"}`} aria-pressed={poolType === "all"} onClick={() => setPoolType("all")}>
                  Todas <span>{questions.length}</span>
                </button>
                {TYPE_CONTROLS.filter(({ type }) => totalByType[type] > 0).map(({ type, label }) => (
                  <button type="button" key={type} className={`btn btn-sm ${poolType === type ? "btn-primary" : "btn-ghost"}`} aria-pressed={poolType === type} onClick={() => setPoolType(type)}>
                    {label} <span>{totalByType[type]}</span>
                  </button>
                ))}
              </div>
              <p className="visual-exam-pool-filter-status">
                <span>
                  {poolFiltersActive ? `Mostrando ${visiblePoolQuestions.length} de ${questions.length}` : `${questions.length - excludedIds.size} disponível(is) · ${selectedQuestions.length} na prova`}
                  {!poolFiltersActive && excludedIds.size > 0 && ` · ${excludedIds.size} fora`}
                </span>
                {poolFiltersActive
                  ? <button type="button" className="btn btn-ghost btn-sm" onClick={clearPoolFilters}>Limpar filtros</button>
                  : <span className="visual-exam-pool-legend">Entra: vai para a prova · Fora: sai do disponível</span>}
              </p>
            </div>
            <div className="visual-exam-pool-list">
              {visiblePoolQuestions.length === 0 && <p className="visual-exam-pool-empty">Nenhuma questão corresponde aos filtros.</p>}
              {visiblePoolQuestions.map((question) => {
                const selected = selectedIds.has(question.id);
                const excluded = excludedIds.has(question.id);
                const selectId = `visual-exam-pool-select-${question.id}`;
                return (
                  <div className={`visual-exam-pool-row${selected ? " is-selected" : ""}${excluded ? " is-excluded" : ""}`} key={question.id}>
                    <div className="visual-exam-pool-toggles">
                      <label className="visual-exam-pool-toggle">
                        <input
                          id={selectId}
                          type="checkbox"
                          checked={selected}
                          disabled={excluded}
                          onChange={() => toggleSelection(question.id)}
                          aria-label={`Selecionar questão ${question.id}`}
                        />
                        <span>Entra</span>
                      </label>
                      <label className="visual-exam-pool-toggle visual-exam-pool-toggle--exclude">
                        <input
                          type="checkbox"
                          checked={excluded}
                          onChange={() => toggleExclusion(question.id)}
                          aria-label={`Deixar questão ${question.id} fora desta prova`}
                        />
                        <span>Fora</span>
                      </label>
                    </div>
                    <label className="visual-exam-pool-copy" htmlFor={selectId}>
                      <strong>Questão {question.id} · {TYPE_LABEL[question.questionType]}{excluded && " · fora desta prova"}</strong>
                      <span className="visual-exam-pool-statement"><RichText html={question.statement} /></span>
                      {question.imageUrl && <span className="visual-exam-image-tag">Imagem</span>}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div id="visual-exam-panel-order" role="tabpanel" aria-labelledby="visual-exam-tab-order" className="visual-exam-panel" hidden={activeTab !== "order"}>
            <p className="form-hint visual-exam-panel-hint">↑ ↓ reordenam dentro do mesmo tipo e largura · Meia/Total troca a largura na folha.</p>
            {orderGroups.length === 0 ? (
              <p className="visual-exam-pool-empty">Nenhuma questão na prova. Marque questões na aba Banco.</p>
            ) : (
              <div className="visual-exam-order-list">
                {orderGroups.map(({ group, questions: groupQuestions }) => (
                  <section className="visual-exam-order-group" key={group.key} aria-labelledby={`group-heading-${group.key}`}>
                    <h4 id={`group-heading-${group.key}`}>{group.label}</h4>
                    <ol>
                      {groupQuestions.map((question) => {
                        const scale = normalizeQuestionImageScalePercent(imageScaleOverrides[question.id]);
                        const position = normalizedOrder.indexOf(question.id) + 1;
                        const atTop = isBoundary(normalizedOrder, question.id, -1, questionById, layoutOverrides);
                        const atBottom = isBoundary(normalizedOrder, question.id, 1, questionById, layoutOverrides);
                        return (
                          <li key={question.id} className="visual-exam-order-row">
                            <div className="visual-exam-order-copy">
                              <strong>{position}. Questão {question.id}</strong>
                              <span className="visual-exam-order-statement"><RichText html={question.statement} /></span>
                              <small>Posição {position} na prova</small>
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
                  </section>
                ))}
              </div>
            )}
          </div>

          <div id="visual-exam-panel-config" role="tabpanel" aria-labelledby="visual-exam-tab-config" className="visual-exam-panel visual-exam-config" hidden={activeTab !== "config"}>
            <label className="form-group">
              <span className="form-label">Instituição</span>
              <input name="institution" className="form-input" value={institution} onChange={(event) => setInstitution(event.currentTarget.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Instruções da primeira página</span>
              <textarea name="instructions" className="form-textarea" value={instructions} onChange={(event) => setInstructions(event.currentTarget.value)} rows={3} required />
            </label>

            <section className="visual-exam-answer-key" aria-labelledby="visual-exam-answer-key-heading">
              <div className="visual-exam-answer-key-heading">
                <div>
                  <strong id="visual-exam-answer-key-heading">Gabarito da última página</strong>
                  <small>PNG/JPG de até 9 MB; a largura muda a paginação no preview.</small>
                </div>
                <span className={`badge${answerKeyFilename ? " badge-success" : ""}`}>
                  {answerKeyFilename ? "Anexado ao rascunho" : "Placeholder ativo"}
                </span>
              </div>

              <div className="visual-exam-answer-key-file">
                <label className="btn btn-ghost btn-sm">
                  {answerKeyFilename ? "Substituir gabarito" : "Anexar gabarito"}
                  <input
                    ref={answerKeyInputRef}
                    className="sr-only"
                    name="answerKeyFile"
                    type="file"
                    accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                    onChange={(event) => selectAnswerKeyFile(event.currentTarget.files?.[0])}
                  />
                </label>
                {answerKeyFilename && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={removeAnswerKeyFile}>
                    Remover
                  </button>
                )}
                <span title={answerKeyFilename ?? undefined}>{answerKeyFilename ?? "Nenhum arquivo escolhido"}</span>
              </div>

              <label className="visual-exam-answer-key-scale">
                <span>
                  Largura do gabarito
                  <output htmlFor="visual-answer-key-width">{answerKeyWidthPt}pt · {getAnswerKeyWidthPercent(answerKeyWidthPt)}%</output>
                </span>
                <input
                  id="visual-answer-key-width"
                  name="answerKeyWidthPt"
                  type="range"
                  min={ANSWER_KEY_MIN_WIDTH_PT}
                  max={ANSWER_KEY_MAX_WIDTH_PT}
                  step={ANSWER_KEY_WIDTH_STEP_PT}
                  value={answerKeyWidthPt}
                  onChange={(event) => setAnswerKeyWidthPt(clampAnswerKeyWidth(Number(event.currentTarget.value)))}
                  aria-label="Tamanho do gabarito"
                />
              </label>
              {answerKeyError && <span className="form-error" role="alert">{answerKeyError}</span>}
            </section>

            <label className="exam-editor-checkbox">
              <input type="checkbox" checked={allowQuestionSplit} onChange={(event) => setAllowQuestionSplit(event.currentTarget.checked)} />
              <span><strong>Permitir quebra de objetivas longas</strong><small>A continuação sempre começa na próxima página.</small></span>
            </label>
          </div>
        </section>

        <aside className="visual-exam-preview-panel card" aria-label="Pré-visualização A4">
          <div className="visual-exam-preview-heading">
            <h2>Folha A4</h2>
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
