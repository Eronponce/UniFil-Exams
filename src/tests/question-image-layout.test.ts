import { describe, expect, it } from "vitest";
import {
  PRINT_IMAGE_MAX_PAGE_AREA_RATIO,
  PRINT_QUESTION_IMAGE_INDENT_PX,
  getPrintQuestionImageWidth,
} from "@/lib/print/question-image-layout";

const PAGE = { pageWidth: 680, pageHeight: 928 };

describe("getPrintQuestionImageWidth", () => {
  it("fills the usable half-page column when the quarter-page area limit allows it", () => {
    const width = getPrintQuestionImageWidth({
      naturalWidth: 553,
      naturalHeight: 725,
      containerWidth: 332,
      ...PAGE,
    });

    expect(width).toBe(332 - PRINT_QUESTION_IMAGE_INDENT_PX);
  });

  it("fills a full-width row for a sufficiently wide image", () => {
    const width = getPrintQuestionImageWidth({
      naturalWidth: 613,
      naturalHeight: 97,
      containerWidth: 680,
      ...PAGE,
    });

    expect(width).toBe(680 - PRINT_QUESTION_IMAGE_INDENT_PX);
  });

  it("shrinks a full-row image proportionally to at most one quarter of the printable page", () => {
    const naturalWidth = 1115;
    const naturalHeight = 640;
    const width = getPrintQuestionImageWidth({
      naturalWidth,
      naturalHeight,
      containerWidth: 680,
      ...PAGE,
    });
    const renderedHeight = width * (naturalHeight / naturalWidth);

    expect(width).toBeLessThan(680 - PRINT_QUESTION_IMAGE_INDENT_PX);
    expect(width * renderedHeight).toBeCloseTo(PAGE.pageWidth * PAGE.pageHeight * PRINT_IMAGE_MAX_PAGE_AREA_RATIO, 5);
  });

  it("never returns a negative width for a container narrower than the indent", () => {
    expect(getPrintQuestionImageWidth({
      naturalWidth: 100,
      naturalHeight: 100,
      containerWidth: 10,
      ...PAGE,
    })).toBe(0);
  });
});
