"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  computeUniformTargetTotalPages,
  planUniformAnswerKeyPlacement,
  paginateQuestionsWithReservedLastPage,
  type PrintQuestionLayoutInput,
  type PrintQuestionPageLayout,
} from "@/lib/print/pagination";
import type { PrintExamPayload, PrintQuestionPayload, PrintSetPayload } from "@/lib/print/build-print-payload";
import { getAnswerKeyWidthRatio } from "@/lib/pdf/answer-key-layout";
import { richTextHasTable } from "@/lib/html/rich-text";

const LETTERS = ["A", "B", "C", "D", "E"];

interface ExamPrintClientProps {
  payload: PrintExamPayload;
  mode: "exam" | "set";
  setId?: number;
}

interface DisplayQuestion extends PrintQuestionPayload {
  displayNumber: number;
  measureKey: string;
}

interface DisplaySet extends PrintSetPayload {
  questions: DisplayQuestion[];
}

interface PageMetrics {
  fullWidth: number;
  fullHeight: number;
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
  renderedSets: RenderedSet[];
  targetTotalPages: number;
  answerKeyWidth: number;
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

function QuestionBlock({ question }: { question: DisplayQuestion }) {
  return (
    <div className="exam-print-question">
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

      {question.questionType === "objetiva" && (
        <div className="exam-print-options">
          {question.shuffledOptions.map((originalIndex, position) => (
            <div key={position} className="exam-print-option">
              <span className="exam-print-option-letter">{LETTERS[position]})</span>
              <span>{question.options[originalIndex]?.text ?? ""}</span>
            </div>
          ))}
        </div>
      )}

      {question.questionType === "verdadeiro_falso" && (
        <div className="exam-print-vf-row">
          {(question.shuffledOptions.length === 2 ? question.shuffledOptions : [0, 1]).map((originalIndex, position) => (
            <div key={position} className="exam-print-vf-option">
              <span className="exam-print-vf-box" />
              <span>{originalIndex === 0 ? "Verdadeiro" : "Falso"}</span>
            </div>
          ))}
        </div>
      )}

      {question.questionType === "dissertativa" && (
        <div className="exam-print-essay-lines">
          {Array.from({ length: question.answerLines > 0 ? question.answerLines : 5 }).map((_, index) => (
            <div key={index} className="exam-print-essay-line" />
          ))}
        </div>
      )}
    </div>
  );
}

function PrintPageHeader({
  title,
  institution,
  setLabel,
  logoUrl,
}: {
  title: string;
  institution: string;
  setLabel: string;
  logoUrl: string | null;
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
    </>
  );
}

function BlankPrintPage() {
  return <section className="exam-print-page exam-print-page--blank" />;
}

export function ExamPrintClient({ payload, mode, setId }: ExamPrintClientProps) {
  const [displaySets] = useState<DisplaySet[]>(() => buildDisplaySets(payload.sets));
  const [metrics, setMetrics] = useState<PageMetrics | null>(null);
  const [renderState, setRenderState] = useState<RenderState | null>(null);
  const prototypeBodyRef = useRef<HTMLDivElement | null>(null);
  const prototypeColumnLeftRef = useRef<HTMLDivElement | null>(null);
  const prototypeColumnRightRef = useRef<HTMLDivElement | null>(null);
  const measurementRootRef = useRef<HTMLDivElement | null>(null);
  const columnMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fullMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let active = true;

    async function measurePrototype() {
      await document.fonts.ready.catch(() => null);
      const body = prototypeBodyRef.current;
      const left = prototypeColumnLeftRef.current;
      const right = prototypeColumnRightRef.current;
      if (!active || !body || !left || !right) return;

      const bodyRect = body.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();

      setMetrics({
        fullWidth: bodyRect.width,
        fullHeight: bodyRect.height,
        columnWidth: leftRect.width,
        leftColumnLeft: leftRect.left - bodyRect.left,
        rightColumnLeft: rightRect.left - bodyRect.left,
      });
    }

    measurePrototype();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!metrics) return;
    let active = true;
    const pageMetrics = metrics;

    async function buildPages() {
      await document.fonts.ready.catch(() => null);
      await waitForImages(measurementRootRef.current);

      const answerKeySize = await loadImageSize(payload.answerKeyUrl);
      if (!active) return;

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

      const measuredSets = displaySets.map((set) => {
        const layoutInputs: PrintQuestionLayoutInput[] = set.questions.map((question) => {
          const columnNode = columnMeasureRefs.current[question.measureKey];
          const fullNode = fullMeasureRefs.current[question.measureKey];

          const forceFullWidth =
            question.questionType === "dissertativa" ||
            getStatementIsFullWidth(question.statementHtml) ||
            !!(columnNode && columnNode.scrollWidth > columnNode.clientWidth + 1);

          return {
            id: question.id,
            displayNumber: question.displayNumber,
            layout: forceFullWidth ? "full" : "column",
            columnHeight: Math.ceil(columnNode?.offsetHeight ?? fullNode?.offsetHeight ?? 0),
            fullHeight: Math.ceil(fullNode?.offsetHeight ?? columnNode?.offsetHeight ?? 0),
          };
        });

        const questionPages = paginateQuestionsWithReservedLastPage(
          layoutInputs,
          pageMetrics.fullHeight,
          pageMetrics.fullHeight,
        );
        const inlineQuestionPages = hasAnswerKey
          ? paginateQuestionsWithReservedLastPage(
              layoutInputs,
              pageMetrics.fullHeight,
              reservedLastPageQuestionAreaHeight,
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

      setRenderState({
        renderedSets,
        targetTotalPages,
        answerKeyWidth,
      });
    }

    buildPages();
    return () => {
      active = false;
    };
  }, [displaySets, metrics, mode, payload.answerKeyUrl, payload.answerKeyWidthPt, setId]);

  return (
    <div className="exam-print-shell">
      <div className="exam-print-toolbar">
        <div>
          <strong>{payload.title}</strong>
          <div className="exam-print-toolbar-copy">
            {mode === "exam" ? "Prova completa" : `Set ${displaySets.find((set) => set.id === setId)?.label ?? ""}`} · formato A4
            {renderState ? ` · ${renderState.targetTotalPages} página(s) por set` : ""}
          </div>
        </div>
        <div className="actions-row">
          <Link href={`/exports?exam=${payload.examId}`} className="btn btn-ghost">
            Voltar
          </Link>
          <a href={mode === "exam" ? `/api/pdf/exam/${payload.examId}` : `/api/pdf/${setId}`} className="btn btn-ghost">
            PDF direto
          </a>
          <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!renderState}>
            Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      {!renderState && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          Montando prova em HTML paginado...
        </div>
      )}

      <div className="exam-print-preview">
        {renderState?.renderedSets.map(({ set, pages }) =>
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
                />
                <div className="exam-print-body">
                  {page.kind === "content" && page.page?.placed.map((placed) => {
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

                    return (
                      <div key={`${placed.id}-${placed.displayNumber}`} className="exam-print-placed" style={style}>
                        <QuestionBlock question={question} />
                      </div>
                    );
                  })}

                  {(page.kind === "answer-key" || page.showAnswerKey) && payload.answerKeyUrl && renderState.answerKeyWidth > 0 && (
                    <div className="exam-print-answer-key" style={{ width: `${renderState.answerKeyWidth}px` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={payload.answerKeyUrl} alt="Gabarito" />
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
                  {question.questionType !== "dissertativa" && (
                    <div
                      ref={(node) => {
                        columnMeasureRefs.current[question.measureKey] = node;
                      }}
                      className="exam-print-measure-box"
                      style={{ width: `${metrics.columnWidth}px` }}
                    >
                      <QuestionBlock question={question} />
                    </div>
                  )}
                  <div
                    ref={(node) => {
                      fullMeasureRefs.current[question.measureKey] = node;
                    }}
                    className="exam-print-measure-box"
                    style={{ width: `${metrics.fullWidth}px` }}
                  >
                    <QuestionBlock question={question} />
                  </div>
                </div>
              )),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
