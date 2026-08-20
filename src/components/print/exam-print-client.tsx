"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  computeUniformTargetTotalPages,
  planUniformAnswerKeyPlacement,
  paginateQuestionsWithReservedLastPage,
  type PrintQuestionLayoutInput,
  type PrintQuestionPageLayout,
  type PrintQuestionSplitLayoutInput,
} from "@/lib/print/pagination";
import type { PrintExamPayload, PrintQuestionPayload, PrintSetPayload } from "@/lib/print/build-print-payload";
import { getAnswerKeyWidthRatio } from "@/lib/pdf/answer-key-layout";
import { richTextHasTable } from "@/lib/html/rich-text";
import { MIN_ESSAY_TABLE_SCALE } from "@/lib/print/table-layout";
import { getPrintQuestionImageWidth } from "@/lib/print/question-image-layout";
import {
  DEFAULT_QUESTION_IMAGE_SCALE_PERCENT,
  MAX_QUESTION_IMAGE_SCALE_PERCENT,
  MIN_QUESTION_IMAGE_SCALE_PERCENT,
  QUESTION_IMAGE_SCALE_QUERY_KEY,
  getQuestionImageScalePercent,
  normalizeQuestionImageScaleOverrides,
  normalizeQuestionImageScalePercent,
  serializeQuestionImageScale,
  type QuestionImageScaleOverrides,
} from "@/lib/print/question-image-scale";

const LETTERS = ["A", "B", "C", "D", "E"];

interface ExamPrintClientProps {
  payload: PrintExamPayload;
  mode: "exam" | "set";
  setId?: number;
  initialImageScaleOverrides?: QuestionImageScaleOverrides;
  /** Embedded previews are controlled by their parent and omit print controls. */
  embedded?: boolean;
  imageScaleOverrides?: QuestionImageScaleOverrides;
  onImageScaleChange?: (overrides: QuestionImageScaleOverrides) => void;
}

interface DisplayQuestion extends PrintQuestionPayload {
  displayNumber: number;
  measureKey: string;
}

interface DisplaySet extends PrintSetPayload {
  questions: DisplayQuestion[];
}

interface PageMetrics {
  measurementKey: string;
  fullWidth: number;
  fullHeight: number;
  firstPageHeight: number;
  columnWidth: number;
  leftColumnLeft: number;
  rightColumnLeft: number;
}

interface RenderedPage {
  kind: "content" | "blank" | "answer-key";
  page: PrintQuestionPageLayout | null;
  showAnswerKey?: boolean;
}

interface RenderedSet {
  set: DisplaySet;
  pages: RenderedPage[];
}

interface RenderState {
  measurementKey: string;
  renderedSets: RenderedSet[];
  targetTotalPages: number;
  answerKeyWidth: number;
  questionRenderPrefs: Record<string, QuestionRenderPrefs>;
}

interface QuestionRenderPrefs {
  tableScale: number;
  adaptiveTable: boolean;
  imageWidth?: number;
}

function buildDisplaySets(sets: PrintSetPayload[]): DisplaySet[] {
  return sets.map((set) => ({
    ...set,
    questions: set.questions.map((question, index) => ({
      ...question,
      displayNumber: index + 1,
      measureKey: `${set.id}-${index + 1}-${question.id}`,
    })),
  }));
}

function getStatementIsFullWidth(html: string): boolean {
  return richTextHasTable(html);
}

function canSplitObjectiveQuestion(question: DisplayQuestion): boolean {
  if (question.questionType !== "objetiva" || question.shuffledOptions.length < 2) return false;
  if (getStatementIsFullWidth(question.statementHtml)) return false;
  return question.shuffledOptions.every((originalIndex) => {
    const text = question.options[originalIndex]?.text;
    return typeof text === "string" && text.trim().length > 0 && !/<\/?[a-z][^>]*>/i.test(text);
  });
}

function getFragmentMeasureKey(
  measureKey: string,
  layout: "column" | "full",
  continuation: boolean,
  start: number,
  end: number,
): string {
  return `${measureKey}-${layout}-${continuation ? "continuation" : "first"}-${start}-${end}`;
}

function getSourceQuestionId(question: PrintQuestionPayload): number {
  return question.sourceQuestionId ?? question.id;
}

/**
 * Metadata rendered in the first-page prototype changes the usable question
 * area. Keep a stable key so pagination never publishes a layout made with a
 * prototype measured for an older header/instructions block.
 */
export function getPrototypeMeasurementKey(
  payload: Pick<PrintExamPayload, "title" | "institution" | "instructions">,
): string {
  return JSON.stringify([payload.title, payload.institution, payload.instructions]);
}

export function isRenderStateCurrent(
  metricsMeasurementKey: string | null | undefined,
  renderMeasurementKey: string | null | undefined,
  prototypeMeasurementKey: string,
): boolean {
  return metricsMeasurementKey === prototypeMeasurementKey && renderMeasurementKey === prototypeMeasurementKey;
}

function pageMetricsEqual(left: PageMetrics, right: PageMetrics): boolean {
  return left.measurementKey === right.measurementKey
    && left.fullWidth === right.fullWidth
    && left.fullHeight === right.fullHeight
    && left.firstPageHeight === right.firstPageHeight
    && left.columnWidth === right.columnWidth
    && left.leftColumnLeft === right.leftColumnLeft
    && left.rightColumnLeft === right.rightColumnLeft;
}

export function resolveInitialImageScaleOverrides(
  persisted: QuestionImageScaleOverrides | null | undefined,
  queryOverrides: QuestionImageScaleOverrides | null | undefined,
): QuestionImageScaleOverrides {
  return {
    ...normalizeQuestionImageScaleOverrides(persisted),
    ...normalizeQuestionImageScaleOverrides(queryOverrides),
  };
}

export function updateImageScaleOverride(
  current: QuestionImageScaleOverrides,
  sourceQuestionId: number,
  rawValue: string | number,
): QuestionImageScaleOverrides {
  const percent = normalizeQuestionImageScalePercent(Number(rawValue));
  const next = { ...current };
  if (percent === DEFAULT_QUESTION_IMAGE_SCALE_PERCENT) delete next[sourceQuestionId];
  else next[sourceQuestionId] = percent;
  return next;
}

export function resetImageScaleOverrides(
  current: QuestionImageScaleOverrides,
  sourceQuestionId?: number,
): QuestionImageScaleOverrides {
  if (sourceQuestionId === undefined) return {};
  const next = { ...current };
  delete next[sourceQuestionId];
  return next;
}

export function buildImageScaleQueryOverrides(
  current: QuestionImageScaleOverrides,
  persistedBase: QuestionImageScaleOverrides,
): QuestionImageScaleOverrides {
  const next = { ...current };
  for (const questionId of Object.keys(persistedBase)) {
    if (!(Number(questionId) in next)) next[Number(questionId)] = DEFAULT_QUESTION_IMAGE_SCALE_PERCENT;
  }
  return next;
}

function applyMeasuredImageWidth(
  node: HTMLDivElement | null | undefined,
  containerWidth: number,
  pageMetrics: PageMetrics,
  scalePercent: number,
): number | undefined {
  const image = node?.querySelector<HTMLImageElement>(".exam-print-question-image");
  if (!node || !image) return undefined;

  const width = getPrintQuestionImageWidth({
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    containerWidth,
    pageWidth: pageMetrics.fullWidth,
    pageHeight: pageMetrics.fullHeight,
    scalePercent,
  });
  node.style.setProperty("--question-image-width", `${width}px`);
  return width;
}

async function waitForImages(root: HTMLElement | null): Promise<void> {
  if (!root) return;
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

async function loadImageSize(src: string | null): Promise<{ width: number; height: number } | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function StatementHtml({ html }: { html: string }) {
  return <div className="rich-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

function InstructionsBlock({ instructions }: { instructions: string }) {
  return (
    <div className="exam-print-instructions" data-testid="exam-print-instructions">
      <div className="exam-print-instructions-title">Instruções</div>
      <div className="exam-print-instructions-copy">
        {instructions.split(/\r?\n/).map((line, index) => (
          <p key={`${index}-${line}`}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export function QuestionBlock({
  question,
  tableScale = 1,
  adaptiveTable = false,
  imageWidth,
  optionStart = 0,
  optionEnd,
  continuation = false,
  continuesToNextPage = false,
}: {
  question: DisplayQuestion;
  tableScale?: number;
  adaptiveTable?: boolean;
  imageWidth?: number;
  optionStart?: number;
  optionEnd?: number;
  continuation?: boolean;
  continuesToNextPage?: boolean;
}) {
  const firstOption = Math.max(0, optionStart);
  const lastOption = Math.min(question.shuffledOptions.length, optionEnd ?? question.shuffledOptions.length);
  const className = `exam-print-question${adaptiveTable ? " exam-print-question--adaptive-table" : ""}`;
  const style = adaptiveTable || imageWidth !== undefined
    ? ({
        ...(adaptiveTable ? { "--essay-table-scale": `${tableScale}` } : {}),
        ...(imageWidth !== undefined ? { "--question-image-width": `${imageWidth}px` } : {}),
      } as CSSProperties)
    : undefined;

  return (
    <>
    <div className={className} style={style}>
      {continuation ? (
        <div className="exam-print-question-continuation">{question.displayNumber}. (continuação)</div>
      ) : (
        <>
          <div className="exam-print-question-header">
            <div className="exam-print-question-number">{question.displayNumber}.</div>
            <div className="exam-print-question-statement">
              <StatementHtml html={question.statementHtml} />
            </div>
          </div>

          {question.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={question.imageUrl} alt="" className="exam-print-question-image" />
          )}
        </>
      )}

      {question.questionType === "objetiva" && (
        <div className="exam-print-options">
          {question.shuffledOptions.slice(firstOption, lastOption).map((originalIndex, offset) => {
            const position = firstOption + offset;
            return (
              <div key={position} className="exam-print-option">
                <span className="exam-print-option-letter">{LETTERS[position]})</span>
                <span>{question.options[originalIndex]?.text ?? ""}</span>
              </div>
            );
          })}
        </div>
      )}


        {question.questionType === "dissertativa" && (
        question.answerLines > 0 && <div className="exam-print-essay-lines">
          {Array.from({ length: question.answerLines }).map((_, index) => (
            <div key={index} className="exam-print-essay-line" />
          ))}
        </div>
      )}

      {question.questionType === "verdadeiro_falso" && (
        <div className="exam-print-vf-row">
          <span className="exam-print-vf-option"><span className="exam-print-vf-box" /> Verdadeiro</span>
          <span className="exam-print-vf-option"><span className="exam-print-vf-box" /> Falso</span>
        </div>
      )}

      {question.questionType === "numerica" && (
        <div className="exam-print-numeric-answer">
          <span>Resposta numérica:</span>
          <span className="exam-print-numeric-line" />
        </div>
      )}
    </div>
    {continuesToNextPage && (
      <div className="exam-print-question-continues" data-testid="exam-print-continuation-marker">
        Questão {question.displayNumber} continua na próxima página →
      </div>
    )}
    </>
  );
}

function PrintPageHeader({
  title,
  institution,
  setLabel,
  logoUrl,
  instructions,
  showInstructions,
}: {
  title: string;
  institution: string;
  setLabel: string;
  logoUrl: string | null;
  instructions?: string;
  showInstructions?: boolean;
}) {
  return (
    <>
      <div className="exam-print-set-label">{setLabel}</div>
      <div className="exam-print-header">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="exam-print-logo" />
        ) : (
          <div className="exam-print-logo-placeholder" />
        )}
        <div className="exam-print-header-text">
          <div className="exam-print-institution">{institution}</div>
          <div className="exam-print-title">{title}</div>
          <div className="exam-print-subtitle">Set {setLabel}</div>
        </div>
      </div>
      {showInstructions && instructions && <InstructionsBlock instructions={instructions} />}
    </>
  );
}

function BlankPrintPage() {
  return <section className="exam-print-page exam-print-page--blank" />;
}

export function ExamPrintClient({
  payload,
  mode,
  setId,
  initialImageScaleOverrides,
  embedded = false,
  imageScaleOverrides: controlledImageScaleOverrides,
  onImageScaleChange,
}: ExamPrintClientProps) {
  const displaySets = useMemo(() => buildDisplaySets(payload.sets), [payload.sets]);
  const persistedImageScaleOverrides = useMemo(() => {
    const persisted: QuestionImageScaleOverrides = {};
    for (const set of payload.sets) {
      for (const question of set.questions) {
        const sourceQuestionId = getSourceQuestionId(question);
        if (question.imageScalePercent !== undefined) persisted[sourceQuestionId] = question.imageScalePercent;
      }
    }
    return persisted;
  }, [payload.sets]);
  const isControlled = controlledImageScaleOverrides !== undefined;
  const [uncontrolledImageScaleOverrides, setUncontrolledImageScaleOverrides] = useState<QuestionImageScaleOverrides>(() => ({
    ...resolveInitialImageScaleOverrides(persistedImageScaleOverrides, initialImageScaleOverrides),
  }));
  const imageScaleOverrides = useMemo(
    () => isControlled ? normalizeQuestionImageScaleOverrides(controlledImageScaleOverrides) : uncontrolledImageScaleOverrides,
    [controlledImageScaleOverrides, isControlled, uncontrolledImageScaleOverrides],
  );
  const prototypeMeasurementKey = useMemo(
    () => getPrototypeMeasurementKey({
      title: payload.title,
      institution: payload.institution,
      instructions: payload.instructions,
    }),
    [payload.institution, payload.instructions, payload.title],
  );
  const [metrics, setMetrics] = useState<PageMetrics | null>(null);
  const [renderState, setRenderState] = useState<RenderState | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const prototypeBodyRef = useRef<HTMLDivElement | null>(null);
  const prototypeFirstBodyRef = useRef<HTMLDivElement | null>(null);
  const prototypeColumnLeftRef = useRef<HTMLDivElement | null>(null);
  const prototypeColumnRightRef = useRef<HTMLDivElement | null>(null);
  const measurementRootRef = useRef<HTMLDivElement | null>(null);
  const columnMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fullMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fragmentMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const measurementRunRef = useRef(0);
  const currentRenderState = isRenderStateCurrent(
    metrics?.measurementKey,
    renderState?.measurementKey,
    prototypeMeasurementKey,
  ) ? renderState : null;

  const imageQuestions = useMemo(() => {
    const firstOccurrenceBySourceId = new Map<number, { first: DisplayQuestion; image: DisplayQuestion | null }>();
    const visibleSets = displaySets.filter((set) => mode === "exam" || set.id === setId);
    for (const set of visibleSets) {
      for (const question of set.questions) {
        const sourceQuestionId = getSourceQuestionId(question);
        const existing = firstOccurrenceBySourceId.get(sourceQuestionId);
        if (existing) {
          if (!existing.image && question.imageUrl) existing.image = question;
        } else {
          firstOccurrenceBySourceId.set(sourceQuestionId, {
            first: question,
            image: question.imageUrl ? question : null,
          });
        }
      }
    }

    return Array.from(firstOccurrenceBySourceId.entries())
      .filter(([, occurrence]) => !!occurrence.image)
      .map(([sourceQuestionId, occurrence]) => ({
        sourceQuestionId,
        displayNumber: occurrence.first.displayNumber,
      }));
  }, [displaySets, mode, setId]);

  useEffect(() => {
    let active = true;
    let measureSequence = 0;

    async function measurePrototype() {
      const sequence = ++measureSequence;
      await document.fonts.ready.catch(() => null);
      const body = prototypeBodyRef.current;
      const firstBody = prototypeFirstBodyRef.current;
      const left = prototypeColumnLeftRef.current;
      const right = prototypeColumnRightRef.current;
      if (!active || sequence !== measureSequence || !body || !firstBody || !left || !right) return;

      const bodyRect = body.getBoundingClientRect();
      const firstBodyRect = firstBody.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const nextMetrics: PageMetrics = {
        measurementKey: prototypeMeasurementKey,
        fullWidth: bodyRect.width,
        fullHeight: bodyRect.height,
        firstPageHeight: firstBodyRect.height,
        columnWidth: leftRect.width,
        leftColumnLeft: leftRect.left - bodyRect.left,
        rightColumnLeft: rightRect.left - bodyRect.left,
      };

      setMetrics((current) => current && pageMetricsEqual(current, nextMetrics) ? current : nextMetrics);
    }

    void measurePrototype();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          void measurePrototype();
        });
    const observedNodes = [
      prototypeBodyRef.current,
      prototypeFirstBodyRef.current,
      prototypeColumnLeftRef.current,
      prototypeColumnRightRef.current,
    ];
    for (const node of observedNodes) {
      if (node) resizeObserver?.observe(node);
    }

    return () => {
      active = false;
      measureSequence += 1;
      resizeObserver?.disconnect();
    };
  }, [prototypeMeasurementKey]);

  useEffect(() => {
    if (!metrics || metrics.measurementKey !== prototypeMeasurementKey) return;
    const measurementRun = measurementRunRef.current + 1;
    measurementRunRef.current = measurementRun;
    let active = true;
    const pageMetrics = metrics;
    const isCurrentRun = () => active && measurementRunRef.current === measurementRun;

    async function buildPages() {
      await document.fonts.ready.catch(() => null);
      if (!isCurrentRun()) return;
      setIsRecalculating(true);
      await waitForImages(measurementRootRef.current);
      if (!isCurrentRun()) return;

      const answerKeySize = await loadImageSize(payload.answerKeyUrl);
      if (!isCurrentRun()) return;

      const configuredAnswerKeyWidth = payload.answerKeyUrl
        ? pageMetrics.fullWidth * getAnswerKeyWidthRatio(payload.answerKeyWidthPt)
        : 0;
      const maxAnswerKeyWidthFromHeight =
        payload.answerKeyUrl && answerKeySize
          ? pageMetrics.fullHeight * (answerKeySize.width / answerKeySize.height)
          : configuredAnswerKeyWidth;
      const answerKeyWidth = payload.answerKeyUrl
        ? Math.min(configuredAnswerKeyWidth, maxAnswerKeyWidthFromHeight)
        : 0;
      const hasAnswerKey = !!payload.answerKeyUrl && answerKeyWidth > 0;
      const answerKeyHeight = hasAnswerKey
        ? answerKeySize
          ? Math.min(pageMetrics.fullHeight, Math.ceil(answerKeyWidth * (answerKeySize.height / answerKeySize.width)))
          : pageMetrics.fullHeight
        : 0;
      const reservedLastPageQuestionAreaHeight = Math.max(0, pageMetrics.fullHeight - answerKeyHeight);

      const questionRenderPrefs: Record<string, QuestionRenderPrefs> = {};

      const measuredSets = displaySets.map((set) => {
        const layoutInputs: PrintQuestionLayoutInput[] = set.questions.map((question) => {
          const columnNode = columnMeasureRefs.current[question.measureKey];
          const fullNode = fullMeasureRefs.current[question.measureKey];
          const hasTable = getStatementIsFullWidth(question.statementHtml);
          const isTableQuestion = hasTable;
          const layout = question.layout ?? payload.questionLayouts[question.questionType];
          const scalePercent = getQuestionImageScalePercent(
            imageScaleOverrides,
            getSourceQuestionId(question),
          );
          const columnImageWidth = applyMeasuredImageWidth(
            columnNode,
            pageMetrics.columnWidth,
            pageMetrics,
            scalePercent,
          );
          const fullImageWidth = applyMeasuredImageWidth(
            fullNode,
            pageMetrics.fullWidth,
            pageMetrics,
            scalePercent,
          );
          const imageWidth = layout === "column" ? columnImageWidth : fullImageWidth;

          if (isTableQuestion && columnNode && fullNode) {
            const measureTable = columnNode.querySelector("table");
            const naturalTableWidth = Math.ceil(
              measureTable?.getBoundingClientRect().width ?? measureTable?.scrollWidth ?? 0,
            );
            const selectedWidth = layout === "column" ? pageMetrics.columnWidth : pageMetrics.fullWidth;
            const tableScale = naturalTableWidth > 0
              ? Math.max(MIN_ESSAY_TABLE_SCALE, Math.min(selectedWidth / naturalTableWidth, 1))
              : 1;

            columnNode.style.setProperty("--essay-table-scale", `${tableScale}`);
            fullNode.style.setProperty("--essay-table-scale", `${tableScale}`);

            questionRenderPrefs[question.measureKey] = {
              tableScale,
              adaptiveTable: true,
              imageWidth,
            };

            return {
              id: question.id,
              displayNumber: question.displayNumber,
              layout,
              columnHeight: Math.ceil(columnNode.offsetHeight),
              fullHeight: Math.ceil(fullNode.offsetHeight),
            };
          }

          questionRenderPrefs[question.measureKey] = {
            tableScale: 1,
            adaptiveTable: isTableQuestion,
            imageWidth,
          };

          let split: PrintQuestionSplitLayoutInput | undefined;
          if (payload.allowQuestionSplit && canSplitObjectiveQuestion(question)) {
            const optionCount = question.shuffledOptions.length;
            const firstHeights = Array.from({ length: optionCount + 1 }, (_, end) => {
              if (end === 0) return 0;
              const node = fragmentMeasureRefs.current[getFragmentMeasureKey(question.measureKey, layout, false, 0, end)];
              if (node && imageWidth !== undefined) node.style.setProperty("--question-image-width", `${imageWidth}px`);
              return node ? Math.ceil(node.offsetHeight) : Number.NaN;
            });
            const continuationHeights = Array.from({ length: optionCount + 1 }, (_, start) =>
              Array.from({ length: optionCount + 1 }, (_, end) => {
                if (start === 0 || end <= start) return 0;
                const node = fragmentMeasureRefs.current[getFragmentMeasureKey(question.measureKey, layout, true, start, end)];
                return node ? Math.ceil(node.offsetHeight) : Number.NaN;
              }),
            );
            const hasAllMeasurements = firstHeights.slice(1).every(Number.isFinite)
              && continuationHeights.slice(1).every((heights, start) =>
                heights.slice(start + 2).every(Number.isFinite),
              );
            if (hasAllMeasurements) {
              split = { optionCount, firstHeights, continuationHeights };
            }
          }

          return {
            id: question.id,
            displayNumber: question.displayNumber,
            layout,
            columnHeight: Math.ceil(columnNode?.offsetHeight ?? fullNode?.offsetHeight ?? 0),
            fullHeight: Math.ceil(fullNode?.offsetHeight ?? columnNode?.offsetHeight ?? 0),
            split,
          };
        });

        const questionPages = paginateQuestionsWithReservedLastPage(
          layoutInputs,
          pageMetrics.fullHeight,
          pageMetrics.fullHeight,
          { allowQuestionSplit: payload.allowQuestionSplit, firstPageQuestionAreaHeight: pageMetrics.firstPageHeight },
        );
        const inlineQuestionPages = hasAnswerKey
          ? paginateQuestionsWithReservedLastPage(
              layoutInputs,
              pageMetrics.fullHeight,
              reservedLastPageQuestionAreaHeight,
              { allowQuestionSplit: payload.allowQuestionSplit, firstPageQuestionAreaHeight: pageMetrics.firstPageHeight },
            )
          : null;
        const inlineTotalPages =
          inlineQuestionPages && inlineQuestionPages.length === questionPages.length ? inlineQuestionPages.length : null;
        const separateTotalPages = questionPages.length + (hasAnswerKey ? 1 : 0);

        return {
          set,
          questionPages,
          inlineQuestionPages,
          inlineTotalPages,
          separateTotalPages,
        };
      });

      const { targetTotalPages, placeAnswerKeyInline } = hasAnswerKey
        ? planUniformAnswerKeyPlacement(
            measuredSets.map((entry) => ({
              inlineTotalPages: entry.inlineTotalPages,
              separateTotalPages: entry.separateTotalPages,
            })),
          )
        : {
            targetTotalPages: computeUniformTargetTotalPages(measuredSets.map((entry) => entry.separateTotalPages)),
            placeAnswerKeyInline: measuredSets.map(() => false),
          };

      const renderedSets = measuredSets
        .map((entry, entryIndex) => {
        const shouldInlineAnswerKey =
          hasAnswerKey && placeAnswerKeyInline[entryIndex] && !!entry.inlineQuestionPages && entry.inlineTotalPages !== null;
        const contentPages = shouldInlineAnswerKey ? (entry.inlineQuestionPages ?? entry.questionPages) : entry.questionPages;
        const currentTotal = shouldInlineAnswerKey ? (entry.inlineTotalPages ?? entry.separateTotalPages) : entry.separateTotalPages;
        const blanksNeeded = Math.max(0, targetTotalPages - currentTotal);
        const pages: RenderedPage[] = contentPages.map((page, pageIndex) => ({
          kind: "content",
          page,
          showAnswerKey: shouldInlineAnswerKey && pageIndex === contentPages.length - 1,
        }));

        for (let blankIndex = 0; blankIndex < blanksNeeded; blankIndex++) {
          pages.push({ kind: "blank", page: null });
        }

        if (hasAnswerKey && !shouldInlineAnswerKey) {
          pages.push({ kind: "answer-key", page: null });
        }

        return { set: entry.set, pages };
      })
        .filter((entry) => mode === "exam" || entry.set.id === setId);

      if (!isCurrentRun()) return;
      setRenderState({
        measurementKey: prototypeMeasurementKey,
        renderedSets,
        targetTotalPages,
        answerKeyWidth,
        questionRenderPrefs,
      });
      setIsRecalculating(false);
    }

    buildPages();
    return () => {
      active = false;
    };
  }, [displaySets, imageScaleOverrides, metrics, mode, payload.allowQuestionSplit, payload.answerKeyUrl, payload.answerKeyWidthPt, payload.questionLayouts, prototypeMeasurementKey, setId]);

  useEffect(() => {
    if (embedded || isControlled) return;
    const serialized = serializeQuestionImageScale(
      buildImageScaleQueryOverrides(imageScaleOverrides, persistedImageScaleOverrides),
      persistedImageScaleOverrides,
    );
    const url = new URL(window.location.href);
    if (serialized) url.searchParams.set(QUESTION_IMAGE_SCALE_QUERY_KEY, serialized);
    else url.searchParams.delete(QUESTION_IMAGE_SCALE_QUERY_KEY);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [embedded, imageScaleOverrides, isControlled, persistedImageScaleOverrides]);

  function commitImageScaleOverrides(next: QuestionImageScaleOverrides): void {
    const normalized = normalizeQuestionImageScaleOverrides(next);
    if (isControlled) {
      onImageScaleChange?.(normalized);
    } else {
      setUncontrolledImageScaleOverrides(normalized);
    }
  }

  function updateImageScale(sourceQuestionId: number, rawValue: string): void {
    commitImageScaleOverrides(updateImageScaleOverride(imageScaleOverrides, sourceQuestionId, rawValue));
  }

  function resetImageScale(sourceQuestionId: number): void {
    commitImageScaleOverrides(resetImageScaleOverrides(imageScaleOverrides, sourceQuestionId));
  }

  /*
   * Keep this helper local to the client component so the embedded builder can
   * control scales without opting into URL synchronization.
   */
  function resetAllImageScales(): void {
    commitImageScaleOverrides(resetImageScaleOverrides(imageScaleOverrides));
  }

  const directPdfQuery = new URLSearchParams();
  if (mode === "exam" && payload.versionNumber) {
    directPdfQuery.set("version", String(payload.versionNumber));
  }
  const serializedImageScale = serializeQuestionImageScale(
    buildImageScaleQueryOverrides(imageScaleOverrides, persistedImageScaleOverrides),
    persistedImageScaleOverrides,
  );
  if (serializedImageScale) directPdfQuery.set(QUESTION_IMAGE_SCALE_QUERY_KEY, serializedImageScale);
  const directPdfQueryString = directPdfQuery.toString();
  const directPdfHref = mode === "exam"
    ? `/api/pdf/exam/${payload.examId}${directPdfQueryString ? `?${directPdfQueryString}` : ""}`
    : `/api/pdf/${setId}${directPdfQueryString ? `?${directPdfQueryString}` : ""}`;
  const PrintMain = embedded ? "div" : "main";

  return (
    <div className={`exam-print-shell${embedded ? " exam-print-shell--embedded" : ""}${!embedded && imageQuestions.length > 0 ? " exam-print-shell--has-image-controls" : ""}`}>
      <div className={`exam-print-layout${!embedded && imageQuestions.length > 0 ? " exam-print-layout--has-image-controls" : ""}`}>
        <PrintMain className="exam-print-main">
      <div className="exam-print-toolbar">
        <div>
          <strong>{payload.title}</strong>
          <div className="exam-print-toolbar-copy">
            {mode === "exam" ? "Prova completa" : `Set ${displaySets.find((set) => set.id === setId)?.label ?? ""}`} · formato A4
            {payload.versionNumber ? ` · versão ${payload.versionNumber}` : ""}
            {currentRenderState ? ` · ${currentRenderState.targetTotalPages} página(s) por set` : ""}
            {isRecalculating ? " · recalculando..." : ""}
          </div>
        </div>
        <div className="exam-print-toolbar-actions">
          <div className="actions-row">
            <Link href={`/exports?exam=${payload.examId}${payload.versionNumber ? `&version=${payload.versionNumber}` : ""}`} className="btn btn-ghost" replace>
              Voltar
            </Link>
            <a href={directPdfHref} className="btn btn-ghost">
              PDF direto
            </a>
            <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!currentRenderState || isRecalculating}>
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>
      </div>

      {!currentRenderState && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          Montando prova em HTML paginado...
        </div>
      )}
      {currentRenderState && isRecalculating && (
        <div className="exam-print-recalculating" role="status" aria-live="polite">
          Recalculando paginação...
        </div>
      )}

      <div className="exam-print-preview">
        {currentRenderState?.renderedSets.map(({ set, pages }) =>
          pages.map((page, pageIndex) =>
            page.kind === "blank" ? (
              <BlankPrintPage key={`${set.id}-blank-${pageIndex}`} />
            ) : (
              <section className="exam-print-page" key={`${set.id}-page-${pageIndex}`}>
                <PrintPageHeader
                  title={payload.title}
                  institution={payload.institution}
                  setLabel={set.label}
                  logoUrl={payload.logoUrl}
                  instructions={payload.instructions}
                  showInstructions={pageIndex === 0}
                />
                <div className="exam-print-body">
                  {page.kind === "content" && page.page?.placed.map((placed, placedIndex) => {
                    const question = set.questions.find((item) => item.id === placed.id && item.displayNumber === placed.displayNumber);
                    if (!question || !metrics) return null;
                    const style =
                      placed.layout === "full"
                        ? {
                            top: `${placed.top}px`,
                            left: "0px",
                            width: `${metrics.fullWidth}px`,
                          }
                        : {
                            top: `${placed.top}px`,
                            left: `${placed.column === "left" ? metrics.leftColumnLeft : metrics.rightColumnLeft}px`,
                            width: `${metrics.columnWidth}px`,
                          };
                    const renderPrefs = currentRenderState.questionRenderPrefs[question.measureKey];
                    const fragmentProps = placed.optionStart !== undefined && placed.optionEnd !== undefined
                      ? {
                          optionStart: placed.optionStart,
                          optionEnd: placed.optionEnd,
                          continuation: placed.continuation ?? false,
                          continuesToNextPage: placed.continuesToNextPage ?? false,
                        }
                      : undefined;

                    return (
                      <div
                        key={`${placed.id}-${placed.displayNumber}-${placed.optionStart ?? "all"}-${placed.optionEnd ?? "all"}-${placedIndex}`}
                        className="exam-print-placed"
                        style={style}
                      >
                        <QuestionBlock
                          question={question}
                          tableScale={renderPrefs?.tableScale ?? 1}
                          adaptiveTable={renderPrefs?.adaptiveTable ?? false}
                          imageWidth={renderPrefs?.imageWidth}
                          {...fragmentProps}
                        />
                      </div>
                    );
                  })}

                  {(page.kind === "answer-key" || page.showAnswerKey) && payload.answerKeyUrl && currentRenderState.answerKeyWidth > 0 && (
                    <div className="exam-print-answer-key" style={{ width: `${currentRenderState.answerKeyWidth}px` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={payload.answerKeyUrl}
                        alt={payload.answerKeyUrl.startsWith("data:image/svg+xml") ? "GABARITO · PLACEHOLDER temporário" : "Gabarito"}
                      />
                    </div>
                  )}
                </div>
              </section>
            ),
          ),
        )}
      </div>

      <div className="exam-print-measurements" aria-hidden="true">
        <section className="exam-print-page">
          <PrintPageHeader
            title={payload.title}
            institution={payload.institution}
            setLabel={displaySets[0]?.label ?? "A"}
            logoUrl={payload.logoUrl}
            instructions={payload.instructions}
            showInstructions
          />
          <div className="exam-print-body" ref={prototypeFirstBodyRef} />
        </section>

        <section className="exam-print-page">
          <PrintPageHeader
            title={payload.title}
            institution={payload.institution}
            setLabel={displaySets[0]?.label ?? "A"}
            logoUrl={payload.logoUrl}
          />
          <div className="exam-print-body" ref={prototypeBodyRef}>
            <div className="exam-print-column-probe" ref={prototypeColumnLeftRef} />
            <div className="exam-print-column-probe" ref={prototypeColumnRightRef} />
          </div>
        </section>

        {metrics && (
          <div ref={measurementRootRef}>
            {displaySets.map((set) =>
              set.questions.map((question) => (
                <div key={question.measureKey}>
                  <div
                    ref={(node) => {
                      columnMeasureRefs.current[question.measureKey] = node;
                    }}
                    className="exam-print-measure-box exam-print-measure-box--column"
                    style={{ width: `${metrics.columnWidth}px` }}
                  >
                    <QuestionBlock
                      question={question}
                      adaptiveTable={getStatementIsFullWidth(question.statementHtml)}
                    />
                  </div>
                  <div
                    ref={(node) => {
                      fullMeasureRefs.current[question.measureKey] = node;
                    }}
                    className="exam-print-measure-box"
                    style={{ width: `${metrics.fullWidth}px` }}
                  >
                    <QuestionBlock
                      question={question}
                      adaptiveTable={getStatementIsFullWidth(question.statementHtml)}
                    />
                  </div>
                  {payload.allowQuestionSplit && canSplitObjectiveQuestion(question) && (["column", "full"] as const).map((layout) => (
                    <div key={`${question.measureKey}-${layout}-fragments`}>
                      {Array.from({ length: question.shuffledOptions.length }, (_, index) => index + 1).map((end) => {
                        const measureKey = getFragmentMeasureKey(question.measureKey, layout, false, 0, end);
                        return (
                          <div
                            key={measureKey}
                            ref={(node) => {
                              fragmentMeasureRefs.current[measureKey] = node;
                            }}
                            className="exam-print-measure-box"
                            style={{ width: `${layout === "column" ? metrics.columnWidth : metrics.fullWidth}px` }}
                          >
                            <QuestionBlock
                              question={question}
                              optionStart={0}
                              optionEnd={end}
                              continuesToNextPage={end < question.shuffledOptions.length}
                            />
                          </div>
                        );
                      })}
                      {Array.from({ length: Math.max(0, question.shuffledOptions.length - 1) }, (_, startIndex) => startIndex + 1).flatMap((start) =>
                        Array.from({ length: question.shuffledOptions.length - start }, (_, endIndex) => start + endIndex + 1).map((end) => {
                          const measureKey = getFragmentMeasureKey(question.measureKey, layout, true, start, end);
                          return (
                            <div
                              key={measureKey}
                              ref={(node) => {
                                fragmentMeasureRefs.current[measureKey] = node;
                              }}
                              className="exam-print-measure-box"
                              style={{ width: `${layout === "column" ? metrics.columnWidth : metrics.fullWidth}px` }}
                            >
                              <QuestionBlock
                                question={question}
                                optionStart={start}
                                optionEnd={end}
                                continuation
                                continuesToNextPage={end < question.shuffledOptions.length}
                              />
                            </div>
                          );
                        }),
                      )}
                    </div>
                  ))}
                </div>
              )),
            )}
          </div>
        )}
      </div>
        </PrintMain>

        {imageQuestions.length > 0 && (
          <aside className="exam-print-scale-sidebar" aria-label="Ajustar imagens">
            <div className="exam-print-scale-sidebar-heading">
              <strong>Ajustar imagens</strong>
              <span>Controles sempre visíveis</span>
            </div>
            <div className="exam-print-scale-panel">
              <p className="exam-print-scale-help">
                Reduza cada imagem entre {MIN_QUESTION_IMAGE_SCALE_PERCENT}% e {MAX_QUESTION_IMAGE_SCALE_PERCENT}% da largura segura calculada.
              </p>
              <div className="exam-print-scale-list">
                {imageQuestions.map(({ sourceQuestionId, displayNumber }) => {
                  const percent = getQuestionImageScalePercent(imageScaleOverrides, sourceQuestionId);
                  const controlId = `exam-print-image-scale-${sourceQuestionId}`;
                  return (
                    <div className="exam-print-scale-row" key={sourceQuestionId}>
                      <label htmlFor={controlId}>
                        Questão {displayNumber}
                        <output htmlFor={controlId}>{percent}%</output>
                      </label>
                      <input
                        id={controlId}
                        type="range"
                        min={MIN_QUESTION_IMAGE_SCALE_PERCENT}
                        max={MAX_QUESTION_IMAGE_SCALE_PERCENT}
                        step="1"
                        value={percent}
                        aria-label={`Escala da imagem da questão ${displayNumber}`}
                        aria-valuetext={`${percent}%`}
                        onChange={(event) => updateImageScale(sourceQuestionId, event.currentTarget.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => resetImageScale(sourceQuestionId)}
                        disabled={percent === DEFAULT_QUESTION_IMAGE_SCALE_PERCENT}
                      >
                        Resetar
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={resetAllImageScales}
                disabled={Object.keys(imageScaleOverrides).length === 0}
              >
                Resetar todas
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
