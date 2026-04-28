import { describe, expect, it } from "vitest";
import { paginateQuestionsWithReservedLastPage } from "@/lib/print/pagination";

describe("paginateQuestionsWithReservedLastPage", () => {
  it("fills the left column first, then the right column", () => {
    const pages = paginateQuestionsWithReservedLastPage(
      [
        { id: 1, displayNumber: 1, layout: "column", columnHeight: 100, fullHeight: 100 },
        { id: 2, displayNumber: 2, layout: "column", columnHeight: 100, fullHeight: 100 },
        { id: 3, displayNumber: 3, layout: "column", columnHeight: 100, fullHeight: 100 },
      ],
      200,
      200,
    );

    expect(pages).toHaveLength(1);
    expect(pages[0].placed.map((item) => `${item.displayNumber}-${item.column ?? "full"}`)).toEqual([
      "1-left",
      "2-left",
      "3-right",
    ]);
  });

  it("moves to the next page when neither column can fit the next question", () => {
    const pages = paginateQuestionsWithReservedLastPage(
      [
        { id: 1, displayNumber: 1, layout: "column", columnHeight: 120, fullHeight: 120 },
        { id: 2, displayNumber: 2, layout: "column", columnHeight: 120, fullHeight: 120 },
        { id: 3, displayNumber: 3, layout: "column", columnHeight: 120, fullHeight: 120 },
      ],
      200,
      200,
    );

    expect(pages).toHaveLength(2);
    expect(pages[0].placed.map((item) => item.displayNumber)).toEqual([1, 2]);
    expect(pages[1].placed.map((item) => `${item.displayNumber}-${item.column ?? "full"}`)).toEqual(["3-left"]);
  });

  it("aligns a full-width question below the tallest current column", () => {
    const pages = paginateQuestionsWithReservedLastPage(
      [
        { id: 1, displayNumber: 1, layout: "column", columnHeight: 100, fullHeight: 100 },
        { id: 2, displayNumber: 2, layout: "column", columnHeight: 60, fullHeight: 60 },
        { id: 3, displayNumber: 3, layout: "full", columnHeight: 0, fullHeight: 80 },
      ],
      300,
      300,
    );

    expect(pages[0].placed).toHaveLength(3);
    const full = pages[0].placed[2];
    expect(full.layout).toBe("full");
    expect(full.top).toBe(160);
  });

  it("reserves less space on the last page for the answer key", () => {
    const pages = paginateQuestionsWithReservedLastPage(
      [
        { id: 1, displayNumber: 1, layout: "column", columnHeight: 120, fullHeight: 120 },
        { id: 2, displayNumber: 2, layout: "column", columnHeight: 120, fullHeight: 120 },
        { id: 3, displayNumber: 3, layout: "column", columnHeight: 120, fullHeight: 120 },
      ],
      240,
      120,
    );

    expect(pages).toHaveLength(2);
    expect(pages[0].placed.map((item) => item.displayNumber)).toEqual([1, 2, 3]);
    expect(pages[1].placed).toEqual([]);
  });
});
