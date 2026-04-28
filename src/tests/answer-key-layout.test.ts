import { describe, expect, it } from "vitest";
import {
  ANSWER_KEY_DEFAULT_WIDTH_PT,
  ANSWER_KEY_MAX_WIDTH_PT,
  ANSWER_KEY_MIN_WIDTH_PT,
  clampAnswerKeyWidth,
  getAnswerKeyWidthPercent,
} from "@/lib/pdf/answer-key-layout";

describe("answer-key-layout", () => {
  it("uses the default width when input is empty", () => {
    expect(clampAnswerKeyWidth(undefined)).toBe(ANSWER_KEY_DEFAULT_WIDTH_PT);
  });

  it("clamps values below the minimum", () => {
    expect(clampAnswerKeyWidth(10)).toBe(ANSWER_KEY_MIN_WIDTH_PT);
  });

  it("clamps values above the maximum", () => {
    expect(clampAnswerKeyWidth(9999)).toBe(ANSWER_KEY_MAX_WIDTH_PT);
  });

  it("rounds values to the configured step", () => {
    expect(clampAnswerKeyWidth(352)).toBe(350);
    expect(clampAnswerKeyWidth(353)).toBe(355);
  });

  it("returns the width as a percent of the usable page width", () => {
    expect(getAnswerKeyWidthPercent(ANSWER_KEY_MAX_WIDTH_PT)).toBe(100);
    expect(getAnswerKeyWidthPercent(ANSWER_KEY_MIN_WIDTH_PT)).toBe(50);
  });
});
