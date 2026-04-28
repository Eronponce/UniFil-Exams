import { describe, expect, it } from "vitest";
import { computeUniformTargetTotalPages, planUniformAnswerKeyPlacement } from "@/lib/print/pagination";

describe("computeUniformTargetTotalPages", () => {
  it("rounds up to next even when max effective is odd", () => {
    expect(computeUniformTargetTotalPages([5, 4, 3])).toBe(6);
  });

  it("keeps total when max effective is already even", () => {
    expect(computeUniformTargetTotalPages([6, 5, 4])).toBe(6);
  });

  it("handles single set with odd effective total", () => {
    expect(computeUniformTargetTotalPages([3])).toBe(4);
  });

  it("handles single set with even effective total", () => {
    expect(computeUniformTargetTotalPages([4])).toBe(4);
  });

  it("falls back to 2 for empty input", () => {
    expect(computeUniformTargetTotalPages([])).toBe(2);
  });

  it("handles all sets with the same total", () => {
    expect(computeUniformTargetTotalPages([3, 3, 3])).toBe(4);
  });
});

describe("planUniformAnswerKeyPlacement", () => {
  it("keeps the answer key inline when the batch target already matches the inline total", () => {
    expect(
      planUniformAnswerKeyPlacement([
        { inlineTotalPages: 2, separateTotalPages: 3 },
        { inlineTotalPages: 2, separateTotalPages: 3 },
      ]),
    ).toEqual({
      targetTotalPages: 2,
      placeAnswerKeyInline: [true, true],
    });
  });

  it("falls back to a separate answer-key page when uniform padding would be required", () => {
    expect(
      planUniformAnswerKeyPlacement([
        { inlineTotalPages: 2, separateTotalPages: 3 },
        { inlineTotalPages: 3, separateTotalPages: 4 },
      ]),
    ).toEqual({
      targetTotalPages: 4,
      placeAnswerKeyInline: [false, false],
    });
  });

  it("supports mixed batches when only some sets match the final target inline", () => {
    expect(
      planUniformAnswerKeyPlacement([
        { inlineTotalPages: 1, separateTotalPages: 2 },
        { inlineTotalPages: 2, separateTotalPages: 3 },
      ]),
    ).toEqual({
      targetTotalPages: 2,
      placeAnswerKeyInline: [false, true],
    });
  });
});
