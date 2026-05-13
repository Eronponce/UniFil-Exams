import { describe, expect, it } from "vitest";
import { MIN_ESSAY_TABLE_SCALE, decideEssayTableLayout } from "@/lib/print/table-layout";

describe("decideEssayTableLayout", () => {
  it("uses column layout when the table fits half page at readable scale", () => {
    const decision = decideEssayTableLayout({
      tableNaturalWidth: 320,
      columnWidth: 300,
      fullWidth: 620,
    });

    expect(decision.layout).toBe("column");
    expect(decision.tableScale).toBeCloseTo(0.9375, 4);
  });

  it("falls back to full width when column would require too much shrinking", () => {
    const decision = decideEssayTableLayout({
      tableNaturalWidth: 520,
      columnWidth: 300,
      fullWidth: 620,
    });

    expect(decision.requiredColumnScale).toBeLessThan(MIN_ESSAY_TABLE_SCALE);
    expect(decision.layout).toBe("full");
  });

  it("caps scale to 1 when the table already fits without shrinking", () => {
    const decision = decideEssayTableLayout({
      tableNaturalWidth: 240,
      columnWidth: 300,
      fullWidth: 620,
    });

    expect(decision.layout).toBe("column");
    expect(decision.tableScale).toBe(1);
  });
});
