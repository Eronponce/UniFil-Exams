import type { QuestionLayout, QuestionType } from "@/types";

/** The persisted/manual order used by visual exam drafts. */
export const CANONICAL_QUESTION_TYPES = Object.freeze([
  "objetiva",
  "verdadeiro_falso",
  "numerica",
  "dissertativa",
] as const satisfies readonly QuestionType[]);

export const CANONICAL_QUESTION_LAYOUTS = Object.freeze(["column", "full"] as const satisfies readonly QuestionLayout[]);

export const CANONICAL_QUESTION_GROUPS = Object.freeze(CANONICAL_QUESTION_TYPES.flatMap((questionType) =>
  CANONICAL_QUESTION_LAYOUTS.map((layout) => Object.freeze({ questionType, layout })),
)) as readonly { questionType: QuestionType; layout: QuestionLayout }[];

// Descriptive aliases keep the immutable contract convenient for callers that
// already refer to type/layout ordering by these names.
export const QUESTION_TYPE_ORDER = CANONICAL_QUESTION_TYPES;
export const QUESTION_LAYOUT_ORDER = CANONICAL_QUESTION_LAYOUTS;
export const CANONICAL_TYPE_ORDER = CANONICAL_QUESTION_TYPES;
export const CANONICAL_GROUP_ORDER = CANONICAL_QUESTION_GROUPS;

export interface ManualOrderQuestionLike {
  id: number;
  questionType: QuestionType;
  layout?: QuestionLayout;
}

function isPositiveQuestionId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isCanonicalQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && CANONICAL_QUESTION_TYPES.includes(value as QuestionType);
}

function canonicalLayout(value: unknown): QuestionLayout {
  return value === "full" ? "full" : "column";
}

function belongsToGroup(question: ManualOrderQuestionLike, group: { questionType: QuestionType; layout: QuestionLayout }): boolean {
  return question.questionType === group.questionType && canonicalLayout(question.layout) === group.layout;
}

/**
 * Normalizes a requested visual order without mutating either input.
 *
 * Requested IDs retain their relative order only within their canonical
 * type/layout group. Unknown and repeated IDs are ignored. Selected records
 * not present in the request are appended by numeric ID within that group so
 * the result is deterministic even when the source collection was unordered.
 */
export function normalizeManualQuestionOrder<T extends ManualOrderQuestionLike>(
  questions: readonly T[],
  requestedIds: readonly number[] | null | undefined,
): T[] {
  const byId = new Map<number, T>();
  for (const question of questions) {
    if (!isPositiveQuestionId(question.id) || !isCanonicalQuestionType(question.questionType) || byId.has(question.id)) continue;
    byId.set(question.id, question);
  }

  const requested: T[] = [];
  const requestedIdsSet = new Set<number>();
  for (const rawId of requestedIds ?? []) {
    if (!isPositiveQuestionId(rawId) || requestedIdsSet.has(rawId)) continue;
    const question = byId.get(rawId);
    if (!question) continue;
    requestedIdsSet.add(rawId);
    requested.push(question);
  }

  const omitted = [...byId.values()]
    .filter((question) => !requestedIdsSet.has(question.id))
    .sort((left, right) => left.id - right.id);

  const normalized: T[] = [];
  for (const group of CANONICAL_QUESTION_GROUPS) {
    normalized.push(
      ...requested.filter((question) => belongsToGroup(question, group)),
      ...omitted.filter((question) => belongsToGroup(question, group)),
    );
  }
  return normalized;
}

export const normalizeCanonicalQuestionOrder = normalizeManualQuestionOrder;
export const normalizeQuestionOrder = normalizeManualQuestionOrder;
export const normalizeManualOrder = normalizeManualQuestionOrder;

export function getCanonicalQuestionGroup(question: ManualOrderQuestionLike): `${QuestionType}:${QuestionLayout}` {
  return `${question.questionType}:${canonicalLayout(question.layout)}`;
}
