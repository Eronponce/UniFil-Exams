import type { QuestionLayout, QuestionOption, QuestionType } from "@/types";
import { buildSets, normalizeExamDraftSeed, type QuestionInfo } from "@/lib/exam/randomize";
import type {
  PrintExamPayload,
  PrintQuestionPayload,
} from "@/lib/print/build-print-payload";

export interface DraftPreviewQuestion {
  id: number;
  statement: string;
  imageUrl: string | null;
  options: QuestionOption[];
  correctIndex: number;
  questionType: QuestionType;
  answerLines: number;
  correctAnswer: string;
}

export interface DraftPreviewDraft {
  title: string;
  institution: string;
  instructions: string;
  quantitySets: number;
  allowQuestionSplit: boolean;
  questionLayouts: Record<QuestionType, QuestionLayout>;
  selectedQuestionIds: readonly number[];
  manualQuestionOrder: readonly number[];
  layoutOverrides: Readonly<Record<number, QuestionLayout>>;
  imageScaleOverrides?: Readonly<Record<number, number>>;
  draftSeed: string | number;
  answerKeyWidthPt?: number;
  answerKeyUrl?: string | null;
}

const SET_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const DEFAULT_DRAFT_PREVIEW_SEED = "visual-default";
const DRAFT_ANSWER_KEY_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1068" height="883" viewBox="0 0 1068 883" role="img" aria-label="GABARITO PLACEHOLDER temporário 1068 por 883 pixels"><rect width="1068" height="883" fill="#f8fafc"/><rect x="24" y="24" width="1020" height="835" rx="18" fill="#fff" stroke="#64748b" stroke-width="4"/><rect x="70" y="70" width="928" height="150" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="12 10"/><text x="534" y="132" fill="#0f172a" font-family="Arial,sans-serif" font-size="42" font-weight="700" text-anchor="middle">GABARITO</text><text x="534" y="180" fill="#475569" font-family="Arial,sans-serif" font-size="25" font-weight="700" text-anchor="middle">PLACEHOLDER TEMPORÁRIO · 1068 × 883 px</text><g fill="#f8fafc" stroke="#94a3b8" stroke-width="3"><rect x="70" y="270" width="270" height="480" rx="14"/><rect x="399" y="270" width="270" height="480" rx="14"/><rect x="728" y="270" width="270" height="480" rx="14"/></g><g fill="none" stroke="#64748b" stroke-width="3">${Array.from({ length: 7 }, (_, row) => Array.from({ length: 5 }, (_, column) => `<circle cx="${130 + column * 47}" cy="${340 + row * 53}" r="15"/><circle cx="${459 + column * 47}" cy="${340 + row * 53}" r="15"/><circle cx="${788 + column * 47}" cy="${340 + row * 53}" r="15"/>`).join("")).join("")}</g><text x="534" y="818" fill="#64748b" font-family="Arial,sans-serif" font-size="22" text-anchor="middle">Pré-visualização gerada pelo sistema — nenhum arquivo da referência foi incorporado</text></svg>`;
/** Client-safe, draft-only image used to exercise real answer-key pagination. */
export const DRAFT_ANSWER_KEY_PLACEHOLDER_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DRAFT_ANSWER_KEY_PLACEHOLDER_SVG)}`;
const DEFAULT_QUESTION_LAYOUTS: Record<QuestionType, QuestionLayout> = {
  objetiva: "column",
  verdadeiro_falso: "column",
  numerica: "column",
  dissertativa: "full",
};

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function normalizeScale(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return undefined;
  if (value < 25 || value > 100) return undefined;
  return value === 100 ? undefined : value;
}

function seedToNumber(seed: string | number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveDraftPreviewSeed(value: unknown): string {
  return normalizeExamDraftSeed(value) ?? DEFAULT_DRAFT_PREVIEW_SEED;
}

/**
 * A deterministic fallback for older randomize implementations. The current
 * backend implementation also receives the seed directly; keeping this
 * function in the options makes the preview deterministic while that shared
 * implementation is being upgraded.
 */
function seededRandom(seed: string | number): () => number {
  let state = seedToNumber(seed) || 1;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) >>> 0;
    let result = state;
    result = Math.imul(result ^ (result >>> 7), 61 | result) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeQuestionOrder(
  questions: readonly DraftPreviewQuestion[],
  selectedIds: readonly number[],
  manualOrder: readonly number[],
): number[] {
  const available = new Map(questions.map((question) => [question.id, question]));
  const selected = new Set(selectedIds.filter((id) => available.has(id)));
  const result: number[] = [];

  for (const id of manualOrder) {
    if (!selected.has(id) || result.includes(id)) continue;
    result.push(id);
  }

  // A stale draft can omit newly filtered questions. Appending them keeps the
  // preview usable without changing the explicit order of questions already in
  // the draft.
  for (const id of selectedIds) {
    if (available.has(id) && !result.includes(id)) result.push(id);
  }

  return result;
}

function makePrintQuestion(
  question: DraftPreviewQuestion,
  shuffledOptions: number[],
  draft: DraftPreviewDraft,
): PrintQuestionPayload {
  const layoutOverride = draft.layoutOverrides[question.id] ?? null;
  const layout = layoutOverride ?? draft.questionLayouts[question.questionType] ?? DEFAULT_QUESTION_LAYOUTS[question.questionType];
  const imageScalePercent = normalizeScale(draft.imageScaleOverrides?.[question.id]);

  return {
    id: question.id,
    sourceQuestionId: question.id,
    statementHtml: question.statement,
    imageUrl: question.imageUrl,
    options: question.options.map((option) => ({ ...option })),
    shuffledOptions: [...shuffledOptions],
    questionType: question.questionType,
    answerLines: question.answerLines,
    layoutOverride,
    layout,
    ...(imageScalePercent === undefined ? {} : { imageScalePercent }),
  };
}

/**
 * Build the synthetic print payload used by the live visual exam builder.
 *
 * This module intentionally imports only the pure randomizer and print types:
 * it is safe to execute in a Client Component and never reads the database or
 * filesystem. Synthetic set IDs are stable for a given set index so switching
 * Set tabs does not reset the print measurement tree unnecessarily.
 */
export function buildDraftPrintPayload(
  questions: readonly DraftPreviewQuestion[],
  draft: DraftPreviewDraft,
): PrintExamPayload {
  const selectedOrder = normalizeQuestionOrder(
    questions,
    draft.selectedQuestionIds,
    draft.manualQuestionOrder,
  );
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const questionInfos: QuestionInfo[] = selectedOrder
    .map((id) => questionById.get(id))
    .filter((question): question is DraftPreviewQuestion => question != null)
    .map((question) => ({
      id: question.id,
      correctIndex: question.correctIndex,
      questionType: question.questionType,
      layout: draft.layoutOverrides[question.id] ?? draft.questionLayouts[question.questionType] ?? DEFAULT_QUESTION_LAYOUTS[question.questionType],
    }));

  const setCount = Math.min(Math.max(positiveInteger(draft.quantitySets, 1), 1), SET_LABELS.length);
  const labels = SET_LABELS.slice(0, setCount) as unknown as string[];
  const normalizedDraftSeed = resolveDraftPreviewSeed(draft.draftSeed);
  const random = seededRandom(normalizedDraftSeed);
  const builtSets = buildSets(
    questionInfos,
    labels,
    {
      // The backend-owned buildSets consumes these frozen options. The cast
      // keeps this client-safe while older local checkouts still expose the
      // pre-migration option type.
      seed: normalizedDraftSeed,
      manualQuestionOrder: selectedOrder,
      random,
    } as Parameters<typeof buildSets>[2],
  );

  const sets = builtSets.map((builtSet, index) => ({
    id: 1_000_000 + index,
    label: builtSet.label,
    questions: builtSet.questionOrder
      .map((questionId, position) => {
        const question = questionById.get(questionId);
        if (!question) return null;
        return makePrintQuestion(
          question,
          builtSet.shuffledOptions[position] ?? [],
          draft,
        );
      })
      .filter((question): question is PrintQuestionPayload => question != null),
  }));

  return {
    examId: 0,
    title: draft.title,
    institution: draft.institution,
    instructions: draft.instructions,
    answerKeyWidthPt: draft.answerKeyWidthPt ?? 180,
    allowQuestionSplit: draft.allowQuestionSplit,
    questionLayouts: {
      ...DEFAULT_QUESTION_LAYOUTS,
      ...draft.questionLayouts,
    },
    logoUrl: null,
    answerKeyUrl: draft.answerKeyUrl || DRAFT_ANSWER_KEY_PLACEHOLDER_URL,
    sets,
  };
}
