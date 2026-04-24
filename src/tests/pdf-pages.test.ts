import { describe, expect, it } from "vitest";
import { computeUniformTargetTotalPages } from "@/lib/pdf/exam-pdf";

describe("computeUniformTargetTotalPages", () => {
  it("adds answer key page and keeps total even when largest set is odd after answer key", () => {
    expect(computeUniformTargetTotalPages([4, 3, 2])).toBe(6);
  });

  it("keeps total even when largest set plus answer key is already even", () => {
    expect(computeUniformTargetTotalPages([5, 4, 3])).toBe(6);
  });

  it("falls back to one question page for empty batches", () => {
    expect(computeUniformTargetTotalPages([])).toBe(2);
  });
});
