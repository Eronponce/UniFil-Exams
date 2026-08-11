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

  it("maintains sequential order even if a later question could fit in a gap in the left column", () => {
    // Capacity 350.
    // Q1, Q2, Q3 (100 each) = 300 on left. 50 left.
    // Q4 (100) -> doesn't fit left, goes to right.
    // Q5 (50) -> could fit in left (50 left), but SHOULD go to right to maintain order.
    const pages = paginateQuestionsWithReservedLastPage(
      [
        { id: 1, displayNumber: 1, layout: "column", columnHeight: 100, fullHeight: 100 },
        { id: 2, displayNumber: 2, layout: "column", columnHeight: 100, fullHeight: 100 },
        { id: 3, displayNumber: 3, layout: "column", columnHeight: 100, fullHeight: 100 },
        { id: 4, displayNumber: 4, layout: "column", columnHeight: 100, fullHeight: 100 },
        { id: 5, displayNumber: 5, layout: "column", columnHeight: 50, fullHeight: 50 },
      ],
      350,
      350,
    );

    expect(pages[0].placed.map((item) => `${item.displayNumber}-${item.column}`)).toEqual([
      "1-left",
      "2-left",
      "3-left",
      "4-right",
      "5-right",
    ]);
  });

  it("keeps split metadata atomic when the opt-in flag is absent", () => {
    const pages = paginateQuestionsWithReservedLastPage(
      [{
        id: 23,
        displayNumber: 23,
        layout: "full",
        columnHeight: 500,
        fullHeight: 500,
        split: {
          optionCount: 5,
          firstHeights: [0, 180, 240, 300, 400, 500],
          continuationHeights: [
            [],
            [0, 0, 100, 180, 260, 340],
            [0, 0, 0, 100, 180, 260],
            [0, 0, 0, 0, 100, 180],
            [0, 0, 0, 0, 0, 100],
            [],
          ],
        },
      }],
      320,
      320,
    );

    expect(pages).toHaveLength(1);
    expect(pages[0].placed).toEqual([{
      id: 23,
      displayNumber: 23,
      layout: "full",
      top: 0,
      height: 500,
    }]);
  });

  it("splits objective option ranges at a boundary without interleaving the next question", () => {
    const pages = paginateQuestionsWithReservedLastPage(
      [
        {
          id: 23,
          displayNumber: 23,
          layout: "full",
          columnHeight: 500,
          fullHeight: 500,
          split: {
            optionCount: 5,
            firstHeights: [0, 180, 240, 300, 400, 500],
            continuationHeights: [
              [],
              [0, 0, 100, 180, 260, 340],
              [0, 0, 0, 100, 180, 260],
              [0, 0, 0, 0, 100, 180],
              [0, 0, 0, 0, 0, 100],
              [],
            ],
          },
        },
        { id: 24, displayNumber: 24, layout: "full", columnHeight: 100, fullHeight: 100 },
      ],
      320,
      320,
      true,
    );

    expect(pages[0].placed.map((item) => [item.id, item.optionStart, item.optionEnd, item.continuation])).toEqual([
      [23, 0, 3, false],
    ]);
    expect(pages[1].placed.map((item) => [item.id, item.optionStart, item.optionEnd, item.continuation])).toEqual([
      [23, 3, 5, true],
      [24, undefined, undefined, undefined],
    ]);

    const optionIndexes = pages
      .flatMap((page) => page.placed)
      .filter((item) => item.id === 23)
      .flatMap((item) => Array.from({ length: item.optionEnd! - item.optionStart! }, (_, index) => item.optionStart! + index));
    expect(optionIndexes).toEqual([0, 1, 2, 3, 4]);
  });

  it("uses the next column for a continuation before opening a page", () => {
    const pages = paginateQuestionsWithReservedLastPage(
      [{
        id: 7,
        displayNumber: 7,
        layout: "column",
        columnHeight: 400,
        fullHeight: 400,
        split: {
          optionCount: 5,
          firstHeights: [0, 150, 220, 290, 360, 430],
          continuationHeights: [
            [],
            [0, 0, 90, 150, 210, 270],
            [0, 0, 0, 90, 150, 210],
            [0, 0, 0, 0, 90, 350],
            [0, 0, 0, 0, 0, 90],
            [],
          ],
        },
      }],
      300,
      300,
      { allowQuestionSplit: true },
    );

    expect(pages[0].placed.map((item) => `${item.id}:${item.column}:${item.optionStart}-${item.optionEnd}`)).toEqual([
      "7:left:0-3",
      "7:right:3-4",
    ]);
    expect(pages[1].placed.map((item) => `${item.id}:${item.column}:${item.optionStart}-${item.optionEnd}`)).toEqual([
      "7:left:4-5",
    ]);
  });

  it("reserves the measured first-page instructions area and uses the stricter one-page capacity", () => {
    const pages = paginateQuestionsWithReservedLastPage(
      [
        { id: 1, displayNumber: 1, layout: "full", columnHeight: 60, fullHeight: 60 },
        { id: 2, displayNumber: 2, layout: "full", columnHeight: 20, fullHeight: 20 },
      ],
      100,
      100,
      { firstPageQuestionAreaHeight: 60 },
    );

    expect(pages).toHaveLength(2);
    expect(pages[0].placed.map((item) => item.displayNumber)).toEqual([1]);
    expect(pages[1].placed.map((item) => item.displayNumber)).toEqual([2]);
  });
});
