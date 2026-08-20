import type { QuestionLayout, QuestionType } from "@/types";
import { normalizeManualQuestionOrder } from "./manual-order";

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface QuestionInfo {
  id: number;
  correctIndex: number;
  questionType: QuestionType;
  layout?: QuestionLayout;
}

export interface ShuffledSet {
  label: string;
  questionOrder: number[];
  shuffledOptions: number[][];
  correctShuffledIndices: number[];
}

export interface BuildSetsOptions {
  /** Keeps the academic type order and groups half-width questions before full-width questions. */
  compactLayoutOrder?: boolean;
  random?: () => number;
  /** Stable, dependency-free seed used for reproducible visual drafts. */
  seed?: string;
  /** Explicit visual order. When present, all sets share this normalized order. */
  manualQuestionOrder?: number[];
}

export const MAX_EXAM_DRAFT_SEED_LENGTH = 128;

export function normalizeExamDraftSeed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, MAX_EXAM_DRAFT_SEED_LENGTH) : undefined;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    // Match the client preview's code-point iteration exactly.
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** FNV-1a plus the preview's integer PRNG keeps browser/server output equal. */
function seededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 7), 61 | value) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function orderTypeGroup(
  questions: QuestionInfo[],
  compactLayoutOrder: boolean,
  random: () => number,
): QuestionInfo[] {
  if (!compactLayoutOrder) return shuffle(questions, random);
  const columns = questions.filter((question) => question.layout !== "full");
  const fullWidth = questions.filter((question) => question.layout === "full");
  return [...shuffle(columns, random), ...shuffle(fullWidth, random)];
}

export function buildSets(
  questions: QuestionInfo[],
  labels: string[],
  options: BuildSetsOptions = {},
): ShuffledSet[] {
  const objetivas = questions.filter((q) => q.questionType === "objetiva");
  const vf = questions.filter((q) => q.questionType === "verdadeiro_falso");
  const numericas = questions.filter((q) => q.questionType === "numerica");
  const dissertativas = questions.filter((q) => q.questionType === "dissertativa");
  const random = options.seed !== undefined
    ? seededRandom(options.seed)
    : options.random ?? Math.random;
  const compact = options.compactLayoutOrder === true;
  const hasManualOrder = options.manualQuestionOrder !== undefined;
  const manualOrder = hasManualOrder
    ? normalizeManualQuestionOrder(questions, options.manualQuestionOrder)
    : [];

  return labels.map((label) => {
    const ordered = hasManualOrder
      ? manualOrder
      : [
        ...orderTypeGroup(objetivas, compact, random),
        ...orderTypeGroup(vf, compact, random),
        ...orderTypeGroup(numericas, compact, random),
        ...(compact ? orderTypeGroup(dissertativas, true, random) : dissertativas),
      ];
    const questionOrder: number[] = [];
    const shuffledOptions: number[][] = [];
    const correctShuffledIndices: number[] = [];

    for (const q of ordered) {
      questionOrder.push(q.id);
      if (q.questionType === "objetiva") {
        const indices = shuffle([0, 1, 2, 3, 4], random);
        shuffledOptions.push(indices);
        correctShuffledIndices.push(indices.indexOf(q.correctIndex));
      } else if (q.questionType === "verdadeiro_falso") {
        const indices = shuffle([0, 1], random);
        shuffledOptions.push(indices);
        correctShuffledIndices.push(indices.indexOf(q.correctIndex));
      } else {
        // numerica / dissertativa: no shuffle, sentinel
        shuffledOptions.push([]);
        correctShuffledIndices.push(0);
      }
    }

    return { label, questionOrder, shuffledOptions, correctShuffledIndices };
  });
}
