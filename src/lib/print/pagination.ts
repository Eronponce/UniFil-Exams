export interface PrintQuestionLayoutInput {
  id: number;
  displayNumber: number;
  layout: "column" | "full";
  columnHeight: number;
  fullHeight: number;
  split?: PrintQuestionSplitLayoutInput;
}

export interface PrintQuestionSplitLayoutInput {
  optionCount: number;
  /** Heights indexed by the exclusive end of the first fragment range [0, end). */
  firstHeights: number[];
  /** Heights indexed by the continuation range [start, end), including its marker. */
  continuationHeights: number[][];
}

export interface PlacedPrintQuestion {
  id: number;
  displayNumber: number;
  layout: "column" | "full";
  column?: "left" | "right";
  top: number;
  height: number;
  optionStart?: number;
  optionEnd?: number;
  continuation?: boolean;
}

export interface PrintQuestionPageLayout {
  placed: PlacedPrintQuestion[];
}

export interface UniformAnswerKeyCandidate {
  inlineTotalPages: number | null;
  separateTotalPages: number;
}

export function computeUniformTargetTotalPages(totals: number[]): number {
  const max = Math.max(...totals, 1);
  return max % 2 === 0 ? max : max + 1;
}

export function planUniformAnswerKeyPlacement(candidates: UniformAnswerKeyCandidate[]): {
  targetTotalPages: number;
  placeAnswerKeyInline: boolean[];
} {
  const targetTotalPages = computeUniformTargetTotalPages(
    candidates.map((candidate) => candidate.inlineTotalPages ?? candidate.separateTotalPages),
  );

  return {
    targetTotalPages,
    placeAnswerKeyInline: candidates.map((candidate) => candidate.inlineTotalPages === targetTotalPages),
  };
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

function placeQuestionFragment(
  page: PrintQuestionPageLayout,
  question: PrintQuestionLayoutInput,
  column: "left" | "right" | undefined,
  top: number,
  fragment: { start: number; end: number; continuation: boolean; height: number },
): void {
  page.placed.push({
    id: question.id,
    displayNumber: question.displayNumber,
    layout: question.layout,
    column,
    top,
    height: fragment.height,
    optionStart: fragment.start,
    optionEnd: fragment.end,
    continuation: fragment.continuation,
  });
}

function attemptAtomicLayout(
  questions: PrintQuestionLayoutInput[],
  capacities: number[],
): PrintQuestionPageLayout[] | null {
  const pages: PrintQuestionPageLayout[] = capacities.map(() => ({ placed: [] }));
  let pageIndex = 0;
  let leftY = 0;
  let rightY = 0;
  let fillingRight = false;

  function nextPage(): boolean {
    pageIndex += 1;
    if (pageIndex >= capacities.length) return false;
    leftY = 0;
    rightY = 0;
    fillingRight = false;
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
          fillingRight = false;
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

      if (!fillingRight && leftY + question.columnHeight <= capacity) {
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
        fillingRight = true;
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

function hasValidSplitLayout(question: PrintQuestionLayoutInput): boolean {
  const split = question.split;
  if (!split || !Number.isInteger(split.optionCount) || split.optionCount < 2) return false;
  if (split.firstHeights.length <= split.optionCount) return false;

  for (let end = 1; end <= split.optionCount; end++) {
    if (!Number.isFinite(split.firstHeights[end]) || split.firstHeights[end] < 0) return false;
  }

  for (let start = 1; start < split.optionCount; start++) {
    for (let end = start + 1; end <= split.optionCount; end++) {
      if (!Number.isFinite(split.continuationHeights[start]?.[end]) || split.continuationHeights[start][end] < 0) return false;
    }
  }

  return true;
}

function getSplitFragmentHeight(
  question: PrintQuestionLayoutInput,
  start: number,
  end: number,
): number {
  const split = question.split!;
  return start === 0 ? split.firstHeights[end] : split.continuationHeights[start][end];
}

function attemptSplitLayout(
  questions: PrintQuestionLayoutInput[],
  capacities: number[],
): PrintQuestionPageLayout[] | null {
  const pages: PrintQuestionPageLayout[] = capacities.map(() => ({ placed: [] }));
  let pageIndex = 0;
  let leftY = 0;
  let rightY = 0;
  let fillingRight = false;

  function nextPage(): boolean {
    pageIndex += 1;
    if (pageIndex >= capacities.length) return false;
    leftY = 0;
    rightY = 0;
    fillingRight = false;
    return true;
  }

  function placeAtomicQuestion(question: PrintQuestionLayoutInput): boolean {
    while (true) {
      if (pageIndex >= capacities.length) return false;
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
          fillingRight = false;
          return true;
        }

        if (page.placed.length === 0) {
          placeOversizeQuestion(page, question, undefined, 0);
          leftY = question.fullHeight;
          rightY = question.fullHeight;
          return true;
        }

        if (!nextPage()) return false;
        continue;
      }

      if (!fillingRight && leftY + question.columnHeight <= capacity) {
        page.placed.push({
          id: question.id,
          displayNumber: question.displayNumber,
          layout: "column",
          column: "left",
          top: leftY,
          height: question.columnHeight,
        });
        leftY += question.columnHeight;
        return true;
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
        fillingRight = true;
        return true;
      }

      if (page.placed.length === 0) {
        placeOversizeQuestion(page, question, "left", 0);
        leftY = question.columnHeight;
        return true;
      }

      if (!nextPage()) return false;
    }
  }

  function placeSplitQuestion(question: PrintQuestionLayoutInput): boolean {
    const split = question.split!;
    let start = 0;
    let firstFragment = true;
    let previousFragmentColumn: "left" | "right" | undefined;

    while (start < split.optionCount) {
      if (!firstFragment && question.layout === "full") {
        if (!nextPage()) return false;
      }
      if (!firstFragment && question.layout === "column" && previousFragmentColumn === "right") {
        if (!nextPage()) return false;
        previousFragmentColumn = undefined;
      }

      while (true) {
        if (pageIndex >= capacities.length) return false;
        const capacity = capacities[pageIndex];
        const page = pages[pageIndex];

        if (question.layout === "full") {
          const top = Math.max(leftY, rightY);
          let chosenEnd: number | null = null;
          for (let end = split.optionCount; end > start; end--) {
            const height = getSplitFragmentHeight(question, start, end);
            if (top + height <= capacity) {
              chosenEnd = end;
              break;
            }
          }

          if (chosenEnd === null && page.placed.length > 0) {
            if (!nextPage()) return false;
            continue;
          }

          const end = chosenEnd ?? start + 1;
          const height = getSplitFragmentHeight(question, start, end);
          placeQuestionFragment(page, question, undefined, chosenEnd === null ? 0 : top, {
            start,
            end,
            continuation: !firstFragment,
            height,
          });
          leftY = (chosenEnd === null ? 0 : top) + height;
          rightY = leftY;
          fillingRight = false;
          start = end;
          firstFragment = false;
          break;
        }

        const candidates: Array<{ column: "left" | "right"; top: number }> = [];
        if (!firstFragment && previousFragmentColumn === "left") {
          candidates.push({ column: "right", top: rightY });
        } else {
          if (!fillingRight) candidates.push({ column: "left", top: leftY });
          candidates.push({ column: "right", top: rightY });
        }

        let chosen: { column: "left" | "right"; top: number; end: number; height: number } | null = null;
        for (const candidate of candidates) {
          for (let end = split.optionCount; end > start; end--) {
            const height = getSplitFragmentHeight(question, start, end);
            if (candidate.top + height <= capacity) {
              chosen = { ...candidate, end, height };
              break;
            }
          }
          if (chosen) break;
        }

        if (chosen) {
          placeQuestionFragment(page, question, chosen.column, chosen.top, {
            start,
            end: chosen.end,
            continuation: !firstFragment,
            height: chosen.height,
          });
          if (chosen.column === "left") leftY += chosen.height;
          else rightY += chosen.height;
          if (chosen.column === "right") fillingRight = true;
          previousFragmentColumn = chosen.column;
          start = chosen.end;
          firstFragment = false;
          break;
        }

        if (page.placed.length === 0) {
          const end = start + 1;
          const height = getSplitFragmentHeight(question, start, end);
          placeQuestionFragment(page, question, "left", 0, {
            start,
            end,
            continuation: !firstFragment,
            height,
          });
          leftY = height;
          fillingRight = start < split.optionCount;
          previousFragmentColumn = "left";
          start = end;
          firstFragment = false;
          break;
        }

        if (!nextPage()) return false;
        previousFragmentColumn = undefined;
      }

      if (start < split.optionCount && question.layout === "column" && !fillingRight) {
        fillingRight = true;
      }
    }

    return true;
  }

  for (const question of questions) {
    if (hasValidSplitLayout(question)) {
      if (!placeSplitQuestion(question)) return null;
    } else if (!placeAtomicQuestion(question)) {
      return null;
    }
  }

  return pages;
}

function resolveAllowQuestionSplit(options: boolean | { allowQuestionSplit?: boolean }): boolean {
  return typeof options === "boolean" ? options : options.allowQuestionSplit === true;
}

export function paginateQuestionsWithReservedLastPage(
  questions: PrintQuestionLayoutInput[],
  questionAreaHeight: number,
  lastPageQuestionAreaHeight: number,
  options: boolean | { allowQuestionSplit?: boolean } = false,
): PrintQuestionPageLayout[] {
  const allowQuestionSplit = resolveAllowQuestionSplit(options);
  const maxSplitFragments = questions.reduce(
    (total, question) => total + (hasValidSplitLayout(question) ? question.split!.optionCount : 1),
    0,
  );
  const maxPageCount = allowQuestionSplit
    ? Math.max(1, maxSplitFragments + 4)
    : Math.max(1, questions.length * 2 + 4);

  for (let pageCount = 1; pageCount <= maxPageCount; pageCount++) {
    const capacities = Array.from({ length: pageCount }, (_, index) =>
      index === pageCount - 1 ? lastPageQuestionAreaHeight : questionAreaHeight,
    );
    const pages = allowQuestionSplit
      ? attemptSplitLayout(questions, capacities)
      : attemptAtomicLayout(questions, capacities);
    if (pages) return pages;
  }

  return [{ placed: [] }];
}
