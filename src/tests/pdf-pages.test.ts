import { describe, expect, it } from "vitest";
import { computeUniformTargetTotalPages } from "@/lib/print/pagination";

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
