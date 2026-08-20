import {
  normalizeQuestionImageScalePercent,
} from "@/lib/print/question-image-scale";

export const PRINT_QUESTION_IMAGE_INDENT_PX = 20;
export const PRINT_IMAGE_MAX_PAGE_AREA_RATIO = 0.25;
export const PRINT_IMAGE_MAX_PAGE_HEIGHT_RATIO = 0.5;

interface PrintQuestionImageWidthInput {
  naturalWidth: number;
  naturalHeight: number;
  containerWidth: number;
  pageWidth: number;
  pageHeight: number;
  indent?: number;
  maxPageAreaRatio?: number;
  /** Presentation-only multiplier applied after the safe width caps. */
  scalePercent?: number;
  /** Backward-compatible descriptive alias for scalePercent. */
  imageScalePercent?: number;
}

/**
 * Fills the question's usable width, then shrinks proportionally only when
 * the image would exceed one quarter of the printable page area. A secondary
 * half-page height cap protects unusually narrow/tall source images.
 */
export function getPrintQuestionImageWidth({
  naturalWidth,
  naturalHeight,
  containerWidth,
  pageWidth,
  pageHeight,
  indent = PRINT_QUESTION_IMAGE_INDENT_PX,
  maxPageAreaRatio = PRINT_IMAGE_MAX_PAGE_AREA_RATIO,
  scalePercent,
  imageScalePercent,
}: PrintQuestionImageWidthInput): number {
  const availableWidth = Math.max(0, containerWidth - indent);
  const normalizedScalePercent = normalizeQuestionImageScalePercent(scalePercent ?? imageScalePercent);
  if (
    availableWidth === 0
    || naturalWidth <= 0
    || naturalHeight <= 0
    || pageWidth <= 0
    || pageHeight <= 0
    || maxPageAreaRatio <= 0
  ) {
    return availableWidth * (normalizedScalePercent / 100);
  }

  const aspectRatio = naturalWidth / naturalHeight;
  const maxArea = pageWidth * pageHeight * maxPageAreaRatio;
  const maxWidthFromArea = Math.sqrt(maxArea * aspectRatio);
  const maxWidthFromHeight = pageHeight * PRINT_IMAGE_MAX_PAGE_HEIGHT_RATIO * aspectRatio;

  const safeWidth = Math.max(0, Math.min(availableWidth, maxWidthFromArea, maxWidthFromHeight));
  return safeWidth * (normalizedScalePercent / 100);
}
