export interface PrintQuestionLayoutInput {
  id: number;
  displayNumber: number;
  layout: "column" | "full";
  columnHeight: number;
  fullHeight: number;
}

export interface PlacedPrintQuestion {
  id: number;
  displayNumber: number;
  layout: "column" | "full";
  column?: "left" | "right";
  top: number;
  height: number;
}

export interface PrintQuestionPageLayout {
  placed: PlacedPrintQuestion[];
}

export function computeUniformTargetTotalPages(totals: number[]): number {
  const max = Math.max(...totals, 1);
  return max % 2 === 0 ? max : max + 1;
}

function placeOversizeQuestion(
  page: PrintQuestionPageLayout,
  question: PrintQuestionLayoutInput,
  column: "left" | "right" | undefined,
  top: number,
): void {
  page.placed.push({
    id: question.id,
    displayNumber: question.displayNumber,
    layout: question.layout,
    column,
    top,
    height: question.layout === "full" ? question.fullHeight : question.columnHeight,
  });
}

function attemptLayout(
  questions: PrintQuestionLayoutInput[],
  capacities: number[],
): PrintQuestionPageLayout[] | null {
  const pages: PrintQuestionPageLayout[] = capacities.map(() => ({ placed: [] }));
  let pageIndex = 0;
  let leftY = 0;
  let rightY = 0;

  function nextPage(): boolean {
    pageIndex += 1;
    if (pageIndex >= capacities.length) return false;
    leftY = 0;
    rightY = 0;
    return true;
  }

  for (const question of questions) {
    while (true) {
      if (pageIndex >= capacities.length) return null;
      const capacity = capacities[pageIndex];
      const page = pages[pageIndex];

      if (question.layout === "full") {
        const alignedTop = Math.max(leftY, rightY);
        if (alignedTop + question.fullHeight <= capacity) {
          page.placed.push({
            id: question.id,
            displayNumber: question.displayNumber,
            layout: "full",
            top: alignedTop,
            height: question.fullHeight,
          });
          leftY = alignedTop + question.fullHeight;
          rightY = leftY;
          break;
        }

        if (page.placed.length === 0) {
          placeOversizeQuestion(page, question, undefined, 0);
          leftY = question.fullHeight;
          rightY = question.fullHeight;
          break;
        }

        if (!nextPage()) return null;
        continue;
      }

      if (leftY + question.columnHeight <= capacity) {
        page.placed.push({
          id: question.id,
          displayNumber: question.displayNumber,
          layout: "column",
          column: "left",
          top: leftY,
          height: question.columnHeight,
        });
        leftY += question.columnHeight;
        break;
      }

      if (rightY + question.columnHeight <= capacity) {
        page.placed.push({
          id: question.id,
          displayNumber: question.displayNumber,
          layout: "column",
          column: "right",
          top: rightY,
          height: question.columnHeight,
        });
        rightY += question.columnHeight;
        break;
      }

      if (page.placed.length === 0) {
        placeOversizeQuestion(page, question, "left", 0);
        leftY = question.columnHeight;
        break;
      }

      if (!nextPage()) return null;
    }
  }

  return pages;
}

export function paginateQuestionsWithReservedLastPage(
  questions: PrintQuestionLayoutInput[],
  questionAreaHeight: number,
  lastPageQuestionAreaHeight: number,
): PrintQuestionPageLayout[] {
  for (let pageCount = 1; pageCount <= Math.max(1, questions.length * 2 + 4); pageCount++) {
    const capacities = Array.from({ length: pageCount }, (_, index) =>
      index === pageCount - 1 ? lastPageQuestionAreaHeight : questionAreaHeight,
    );
    const pages = attemptLayout(questions, capacities);
    if (pages) return pages;
  }

  return [{ placed: [] }];
}
