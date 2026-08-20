import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUESTION_IMAGE_SCALE_PERCENT,
  MAX_QUESTION_IMAGE_SCALE_PERCENT,
  MIN_QUESTION_IMAGE_SCALE_PERCENT,
  normalizeQuestionImageScaleOverrides,
  parseQuestionImageScale,
  serializeQuestionImageScale,
} from "@/lib/print/question-image-scale";
import {
  buildImageScaleQueryOverrides,
  resetImageScaleOverrides,
  resolveInitialImageScaleOverrides,
  updateImageScaleOverride,
} from "@/components/print/exam-print-client";

describe("question image scale query helpers", () => {
  it("ignores malformed entries and keeps only valid positive IDs and percentages", () => {
    expect(parseQuestionImageScale(
      "12:75,0:50,-4:50,48:24,49:101,not-an-entry,9007199254740992:50,50:50,51:50:extra",
    )).toEqual({ 12: 75, 50: 50 });
  });

  it("uses the last valid value for duplicate IDs", () => {
    expect(parseQuestionImageScale("12:75,12:bad,12:50,12:100")).toEqual({ 12: 100 });
  });

  it("serializes by numeric ID and omits default values", () => {
    expect(serializeQuestionImageScale({ 48: 50, 3: 100, 12: 75 })).toBe("12:75,48:50");
  });

  it("keeps an explicit 100% reset when a persisted 75% base exists", () => {
    const persisted = { 7: 75 };
    const initial = resolveInitialImageScaleOverrides(persisted, {});
    expect(serializeQuestionImageScale(initial, persisted)).toBe("");

    const atDefault = updateImageScaleOverride(initial, 7, "100");
    const atDefaultQuery = serializeQuestionImageScale(buildImageScaleQueryOverrides(atDefault, persisted), persisted);
    expect(atDefaultQuery).toBe("7:100");

    const reset = resetImageScaleOverrides(atDefault, 7);
    expect(serializeQuestionImageScale(buildImageScaleQueryOverrides(reset, persisted), persisted)).toBe("7:100");
    const resetAll = resetImageScaleOverrides({ 7: 60 });
    expect(serializeQuestionImageScale(buildImageScaleQueryOverrides(resetAll, persisted), persisted)).toBe("7:100");
  });

  it("normalizes object input without accepting invalid values", () => {
    expect(normalizeQuestionImageScaleOverrides({
      48: 50,
      12: DEFAULT_QUESTION_IMAGE_SCALE_PERCENT,
      0: 75,
      9: 24,
      10: "75",
    })).toEqual({ 12: 100, 48: 50 });
  });

  it("round trips non-default overrides", () => {
    const serialized = serializeQuestionImageScale({ 48: 50, 12: 75 });
    expect(parseQuestionImageScale(serialized)).toEqual({ 12: 75, 48: 50 });
  });

  it("exposes the shared range contract", () => {
    expect(MIN_QUESTION_IMAGE_SCALE_PERCENT).toBe(25);
    expect(DEFAULT_QUESTION_IMAGE_SCALE_PERCENT).toBe(100);
    expect(MAX_QUESTION_IMAGE_SCALE_PERCENT).toBe(100);
  });
});
