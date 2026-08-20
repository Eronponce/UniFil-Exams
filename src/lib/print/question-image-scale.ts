export const QUESTION_IMAGE_SCALE_QUERY_KEY = "imageScale";
export const MIN_QUESTION_IMAGE_SCALE_PERCENT = 25;
export const DEFAULT_QUESTION_IMAGE_SCALE_PERCENT = 100;
export const MAX_QUESTION_IMAGE_SCALE_PERCENT = 100;

// Short aliases keep the constants convenient for callers that only deal with
// the query value while the longer names make their scope explicit.
export const IMAGE_SCALE_QUERY_KEY = QUESTION_IMAGE_SCALE_QUERY_KEY;
export const IMAGE_SCALE_MIN_PERCENT = MIN_QUESTION_IMAGE_SCALE_PERCENT;
export const IMAGE_SCALE_DEFAULT_PERCENT = DEFAULT_QUESTION_IMAGE_SCALE_PERCENT;
export const IMAGE_SCALE_MAX_PERCENT = MAX_QUESTION_IMAGE_SCALE_PERCENT;

export type QuestionImageScaleOverrides = Record<number, number>;

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function isValidQuestionImageScalePercent(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= MIN_QUESTION_IMAGE_SCALE_PERCENT
    && value <= MAX_QUESTION_IMAGE_SCALE_PERCENT;
}

export function normalizeQuestionImageScalePercent(value: unknown): number {
  return isValidQuestionImageScalePercent(value) ? value : DEFAULT_QUESTION_IMAGE_SCALE_PERCENT;
}

/**
 * Copies only valid numeric question IDs and integer scale percentages. The
 * default value is retained here so parsing remains lossless. Serialization
 * omits it unless a non-default persisted base is supplied and the explicit
 * 100% value is needed as a tombstone override.
 */
export function normalizeQuestionImageScaleOverrides(value: unknown): QuestionImageScaleOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const normalized: QuestionImageScaleOverrides = {};
  for (const [rawQuestionId, rawPercent] of Object.entries(value)) {
    const questionId = Number(rawQuestionId);
    if (!isPositiveSafeInteger(questionId) || !isValidQuestionImageScalePercent(rawPercent)) continue;
    normalized[questionId] = rawPercent;
  }
  return normalized;
}

/** Parse the comma-separated `questionId:percent` query representation. */
export function parseQuestionImageScale(value: string | null | undefined): QuestionImageScaleOverrides {
  if (typeof value !== "string" || value.length === 0) return {};

  const parsed: QuestionImageScaleOverrides = {};
  for (const rawEntry of value.split(",")) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const parts = entry.split(":");
    if (parts.length !== 2) continue;

    const [rawQuestionId, rawPercent] = parts;
    if (!/^\d+$/.test(rawQuestionId) || !/^\d+$/.test(rawPercent)) continue;
    const questionId = Number(rawQuestionId);
    const percent = Number(rawPercent);
    if (!isPositiveSafeInteger(questionId) || !isValidQuestionImageScalePercent(percent)) continue;

    // Assignment order intentionally gives the last valid duplicate the win.
    parsed[questionId] = percent;
  }
  return parsed;
}

/**
 * Serialize valid overrides by numeric question ID. A 100% value is omitted
 * for a question without a persisted non-default base; when a base map is
 * supplied, an explicit 100% remains representable as a reset tombstone.
 */
export function serializeQuestionImageScale(
  value: QuestionImageScaleOverrides | null | undefined,
  persistedBaseOverrides?: QuestionImageScaleOverrides | null,
): string {
  const normalized = normalizeQuestionImageScaleOverrides(value);
  const persistedBase = normalizeQuestionImageScaleOverrides(persistedBaseOverrides);
  return Object.entries(normalized)
    .filter(([questionId, percent]) => {
      const base = persistedBase[Number(questionId)];
      if (percent === DEFAULT_QUESTION_IMAGE_SCALE_PERCENT) return base !== undefined && base !== DEFAULT_QUESTION_IMAGE_SCALE_PERCENT;
      return percent !== base;
    })
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([questionId, percent]) => `${questionId}:${percent}`)
    .join(",");
}

/**
 * Serialize a sanitized query map when forwarding it between PDF endpoints.
 * Unlike the UI serializer, this must retain an explicit 100% value: the
 * print page may have a persisted non-default scale that the query is
 * intentionally resetting, but the forwarding route does not have that base
 * map available to manufacture the tombstone later.
 */
export function serializeQuestionImageScaleForForwarding(
  value: QuestionImageScaleOverrides | null | undefined,
): string {
  return Object.entries(normalizeQuestionImageScaleOverrides(value))
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([questionId, percent]) => `${questionId}:${percent}`)
    .join(",");
}

export function getQuestionImageScalePercent(
  overrides: QuestionImageScaleOverrides | null | undefined,
  questionId: number,
): number {
  if (!isPositiveSafeInteger(questionId)) return DEFAULT_QUESTION_IMAGE_SCALE_PERCENT;
  return normalizeQuestionImageScalePercent(overrides?.[questionId]);
}

// Descriptive aliases for callers that prefer the full helper name.
export const parseQuestionImageScaleOverrides = parseQuestionImageScale;
export const serializeQuestionImageScaleOverrides = serializeQuestionImageScale;
