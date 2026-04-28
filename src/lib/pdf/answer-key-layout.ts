export const PAGE_PADDING = 42.52;
export const PAGE_W = 595.28;
export const ANSWER_KEY_MAX_WIDTH_PT = Math.round(PAGE_W - 2 * PAGE_PADDING);
export const ANSWER_KEY_MIN_WIDTH_PT = Math.round(ANSWER_KEY_MAX_WIDTH_PT / 2);
export const ANSWER_KEY_DEFAULT_WIDTH_PT = 350;
export const ANSWER_KEY_WIDTH_STEP_PT = 5;

export function clampAnswerKeyWidth(widthPt: number | null | undefined): number {
  const raw = Number(widthPt);
  if (!Number.isFinite(raw)) return ANSWER_KEY_DEFAULT_WIDTH_PT;

  const clamped = Math.min(ANSWER_KEY_MAX_WIDTH_PT, Math.max(ANSWER_KEY_MIN_WIDTH_PT, raw));
  return Math.round(clamped / ANSWER_KEY_WIDTH_STEP_PT) * ANSWER_KEY_WIDTH_STEP_PT;
}

export function getAnswerKeyWidthRatio(widthPt: number | null | undefined): number {
  return clampAnswerKeyWidth(widthPt) / ANSWER_KEY_MAX_WIDTH_PT;
}

export function getAnswerKeyWidthPercent(widthPt: number | null | undefined): number {
  return Math.round(getAnswerKeyWidthRatio(widthPt) * 100);
}
