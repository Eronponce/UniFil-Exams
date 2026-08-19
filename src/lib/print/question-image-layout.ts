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
}: PrintQuestionImageWidthInput): number {
  const availableWidth = Math.max(0, containerWidth - indent);
  if (
    availableWidth === 0
    || naturalWidth <= 0
    || naturalHeight <= 0
    || pageWidth <= 0
    || pageHeight <= 0
    || maxPageAreaRatio <= 0
  ) {
    return availableWidth;
  }

  const aspectRatio = naturalWidth / naturalHeight;
  const maxArea = pageWidth * pageHeight * maxPageAreaRatio;
  const maxWidthFromArea = Math.sqrt(maxArea * aspectRatio);
  const maxWidthFromHeight = pageHeight * PRINT_IMAGE_MAX_PAGE_HEIGHT_RATIO * aspectRatio;

  return Math.min(availableWidth, maxWidthFromArea, maxWidthFromHeight);
}
