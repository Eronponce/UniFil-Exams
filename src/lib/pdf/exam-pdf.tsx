import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, type DocumentProps } from "@react-pdf/renderer";
import type { Exam, ExamSet, QuestionType } from "@/types";
import { getQuestion } from "@/lib/db/questions";
import fs from "fs";
import path from "path";

const LETTERS = ["A", "B", "C", "D", "E"];

function readBuf(filePath: string): Buffer | null {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function getLogoBuf(): Buffer | null {
  for (const ext of ["png", "jpg", "jpeg"]) {
    const buf = readBuf(path.join(process.cwd(), "public", `unifil-logo.${ext}`));
    if (buf) return buf;
  }
  return null;
}

function getGabaritoBuf(examId: number): Buffer | null {
  const dir = path.join(process.cwd(), "public", "gabaritos");
  for (const ext of ["png", "jpg", "jpeg"]) {
    const buf = readBuf(path.join(dir, `${examId}.${ext}`));
    if (buf) return buf;
  }
  return null;
}

const PAGE_PADDING = 42.52;
const PAGE_H = 841.89;
const HEADER_H = 52;
const SECTION_DIVIDER_H = 28;
const AVAILABLE_COL_H = PAGE_H - PAGE_PADDING * 2 - HEADER_H;
const CHARS_PER_LINE = 40;
const CHARS_PER_OPT_LINE = 42;
const BLANK_LINE_H = 18;

interface ProcessedQ {
  id: number;
  statement: string;
  options: { text: string }[];
  shuffledOptions: number[];
  imageBuf: Buffer | null;
  questionType: QuestionType;
  answerLines: number;
}

interface NumberedQ extends ProcessedQ {
  displayNumber: number;
}

interface SectionDefinition {
  key: string;
  title: string;
  layout: "two" | "single";
  qs: ProcessedQ[];
}

interface TwoColumnSegment {
  kind: "two";
  title?: string;
  col1: NumberedQ[];
  col2: NumberedQ[];
}

interface SingleColumnSegment {
  kind: "single";
  title?: string;
  qs: NumberedQ[];
}

type PageSegment = TwoColumnSegment | SingleColumnSegment;

interface BuiltPage {
  segments: PageSegment[];
}

function estimateObjetivaH(statement: string, options: string[]): number {
  const statLines = Math.max(1, Math.ceil(statement.length / CHARS_PER_LINE));
  const statH = (1 + statLines) * 14;
  const optH = options.reduce((sum, option) => sum + Math.ceil(option.length / CHARS_PER_OPT_LINE) * 13, 0);
  return statH + optH + 14;
}

function estimateVFH(statement: string): number {
  const statLines = Math.max(1, Math.ceil(statement.length / CHARS_PER_LINE));
  return (1 + statLines) * 14 + 2 * 13 + 14;
}

function estimateDissertativaH(statement: string, answerLines: number): number {
  const statLines = Math.max(1, Math.ceil(statement.length / (CHARS_PER_LINE * 2)));
  return (1 + statLines) * 14 + (answerLines || 5) * BLANK_LINE_H + 20;
}

function estimateQuestionHeight(q: ProcessedQ): number {
  if (q.questionType === "dissertativa") return estimateDissertativaH(q.statement, q.answerLines);
  if (q.questionType === "verdadeiro_falso") return estimateVFH(q.statement);
  return estimateObjetivaH(q.statement, q.options.map((option) => option.text));
}

function packTwoColumnChunk(qs: ProcessedQ[], availableHeight: number) {
  const col1: ProcessedQ[] = [];
  const col2: ProcessedQ[] = [];
  let h1 = 0;
  let h2 = 0;

  for (const q of qs) {
    const qh = estimateQuestionHeight(q);
    if (h1 + qh <= availableHeight) {
      col1.push(q);
      h1 += qh;
      continue;
    }
    if (h2 + qh <= availableHeight) {
      col2.push(q);
      h2 += qh;
      continue;
    }
    break;
  }

  if (!col1.length && !col2.length && qs[0]) {
    const qh = estimateQuestionHeight(qs[0]);
    return { col1: [qs[0]], col2: [], consumedHeight: qh, usedCount: 1 };
  }

  return {
    col1,
    col2,
    consumedHeight: Math.max(h1, h2),
    usedCount: col1.length + col2.length,
  };
}

function packSingleColumnChunk(qs: ProcessedQ[], availableHeight: number) {
  const items: ProcessedQ[] = [];
  let consumedHeight = 0;

  for (const q of qs) {
    const qh = estimateQuestionHeight(q);
    if (consumedHeight + qh <= availableHeight) {
      items.push(q);
      consumedHeight += qh;
      continue;
    }
    break;
  }

  if (!items.length && qs[0]) {
    return { items: [qs[0]], consumedHeight: estimateQuestionHeight(qs[0]), usedCount: 1 };
  }

  return { items, consumedHeight, usedCount: items.length };
}

function buildQuestionPages(sections: SectionDefinition[]): BuiltPage[] {
  const pages: BuiltPage[] = [];
  let currentPage: BuiltPage = { segments: [] };
  let remainingHeight = AVAILABLE_COL_H;
  let globalNumber = 0;

  function pushPage() {
    if (currentPage.segments.length) pages.push(currentPage);
    currentPage = { segments: [] };
    remainingHeight = AVAILABLE_COL_H;
  }

  for (const section of sections) {
    let remainingQs = [...section.qs];
    let isFirstChunk = true;

    while (remainingQs.length > 0) {
      const titleCost = isFirstChunk ? SECTION_DIVIDER_H : 0;
      const availableHeight = remainingHeight - titleCost;
      if (availableHeight <= 0) {
        pushPage();
        continue;
      }

      if (section.layout === "two") {
        const packed = packTwoColumnChunk(remainingQs, availableHeight);
        const col1 = packed.col1.map((q) => ({ ...q, displayNumber: ++globalNumber }));
        const col2 = packed.col2.map((q) => ({ ...q, displayNumber: ++globalNumber }));
        currentPage.segments.push({ kind: "two", title: isFirstChunk ? section.title : undefined, col1, col2 });
        remainingHeight -= titleCost + packed.consumedHeight;
        remainingQs = remainingQs.slice(packed.usedCount);
      } else {
        const packed = packSingleColumnChunk(remainingQs, availableHeight);
        const qs = packed.items.map((q) => ({ ...q, displayNumber: ++globalNumber }));
        currentPage.segments.push({ kind: "single", title: isFirstChunk ? section.title : undefined, qs });
        remainingHeight -= titleCost + packed.consumedHeight;
        remainingQs = remainingQs.slice(packed.usedCount);
      }

      isFirstChunk = false;
      if (remainingQs.length > 0 && remainingHeight <= 12) pushPage();
    }
  }

  if (currentPage.segments.length) pages.push(currentPage);
  return pages;
}

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: PAGE_PADDING, backgroundColor: "#ffffff" },
  header: { marginBottom: 10, borderBottom: "1pt solid #cccccc", paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 34, height: 34, objectFit: "contain" },
  headerText: { flex: 1 },
  institution: { fontSize: 8, color: "#777777", marginBottom: 1 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  subtitle: { fontSize: 9, color: "#555555" },
  setLabel: { position: "absolute", top: PAGE_PADDING, right: PAGE_PADDING, fontSize: 22, fontFamily: "Helvetica-Bold", color: "#aaaaaa" },
  sectionDivider: { borderTop: "1pt solid #999999", borderBottom: "1pt solid #999999", paddingVertical: 4, marginBottom: 8, marginTop: 2 },
  sectionDividerText: { fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "center", color: "#444444" },
  columns: { flexDirection: "row", gap: 16, marginBottom: 2 },
  column: { flex: 1 },
  question: { marginBottom: 12 },
  qHeader: { flexDirection: "row", gap: 4, marginBottom: 4 },
  qNum: { fontFamily: "Helvetica-Bold", fontSize: 10, width: 16 },
  statement: { fontSize: 10, lineHeight: 1.4, flex: 1 },
  option: { flexDirection: "row", gap: 4, marginBottom: 2, paddingLeft: 18 },
  optLetter: { fontFamily: "Helvetica-Bold", width: 14 },
  optText: { flex: 1, fontSize: 9.5, color: "#222222" },
  qImage: { maxWidth: 220, marginBottom: 4, marginLeft: 20 },
  vfRow: { flexDirection: "row", gap: 16, paddingLeft: 18, marginTop: 2 },
  vfOption: { flexDirection: "row", gap: 4, alignItems: "center" },
  vfBox: { width: 10, height: 10, border: "1pt solid #555555" },
  vfLabel: { fontSize: 9.5, color: "#222222" },
  blankLine: { borderBottom: "0.5pt solid #aaaaaa", height: BLANK_LINE_H, marginBottom: 2 },
  akPage: { padding: PAGE_PADDING, backgroundColor: "#ffffff" },
  akImageWrap: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: PAGE_PADDING },
  blankPage: { backgroundColor: "#ffffff" },
});

function Header({ title, institution, setLabel, logoBuf }: { title: string; institution: string; setLabel: string; logoBuf: Buffer | null }) {
  return (
    <View style={s.header}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {logoBuf && <Image src={logoBuf} style={s.logo} />}
      <View style={s.headerText}>
        <Text style={s.institution}>{institution}</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>Set {setLabel}</Text>
      </View>
    </View>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <View style={s.sectionDivider}>
      <Text style={s.sectionDividerText}>{title}</Text>
    </View>
  );
}

function QuestionView({ q }: { q: NumberedQ }) {
  return (
    <View style={s.question}>
      <View style={s.qHeader}>
        <Text style={s.qNum}>{q.displayNumber}.</Text>
        <Text style={s.statement}>{q.statement}</Text>
      </View>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {q.imageBuf && <Image src={q.imageBuf} style={s.qImage} />}
      {q.shuffledOptions.map((origIdx, pos) => (
        <View key={pos} style={s.option}>
          <Text style={s.optLetter}>{LETTERS[pos]})</Text>
          <Text style={s.optText}>{q.options[origIdx]?.text ?? ""}</Text>
        </View>
      ))}
    </View>
  );
}

function VFQuestionView({ q }: { q: NumberedQ }) {
  const labels = ["Verdadeiro", "Falso"];
  const opts = q.shuffledOptions.length === 2 ? q.shuffledOptions : [0, 1];
  return (
    <View style={s.question}>
      <View style={s.qHeader}>
        <Text style={s.qNum}>{q.displayNumber}.</Text>
        <Text style={s.statement}>{q.statement}</Text>
      </View>
      <View style={s.vfRow}>
        {opts.map((origIdx, pos) => (
          <View key={pos} style={s.vfOption}>
            <View style={s.vfBox} />
            <Text style={s.vfLabel}>{labels[origIdx]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DissertativaQuestionView({ q }: { q: NumberedQ }) {
  const lines = q.answerLines > 0 ? q.answerLines : 5;
  return (
    <View style={s.question}>
      <View style={s.qHeader}>
        <Text style={s.qNum}>{q.displayNumber}.</Text>
        <Text style={s.statement}>{q.statement}</Text>
      </View>
      {Array.from({ length: lines }).map((_, index) => (
        <View key={index} style={s.blankLine} />
      ))}
    </View>
  );
}

function renderQuestion(q: NumberedQ) {
  if (q.questionType === "dissertativa") return <DissertativaQuestionView key={q.id} q={q} />;
  if (q.questionType === "verdadeiro_falso") return <VFQuestionView key={q.id} q={q} />;
  return <QuestionView key={q.id} q={q} />;
}

function AnswerKeyPage({ gabaritoBuf }: { gabaritoBuf: Buffer | null }) {
  return (
    <Page size="A4" style={s.akPage}>
      <View style={s.akImageWrap}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {gabaritoBuf && <Image src={gabaritoBuf} style={{ width: 149 }} />}
      </View>
    </Page>
  );
}

function prepareSetSections(set: ExamSet): SectionDefinition[] {
  const allProcessed: ProcessedQ[] = set.questions
    .sort((a, b) => a.position - b.position)
    .map((sq) => {
      const q = getQuestion(sq.questionId);
      if (!q) return null;
      let imageBuf: Buffer | null = null;
      if (q.imageUrl) imageBuf = readBuf(path.join(process.cwd(), "public", q.imageUrl.replace(/^\//, "")));
      return {
        id: q.id,
        statement: q.statement,
        options: q.options,
        shuffledOptions: sq.shuffledOptions,
        imageBuf,
        questionType: q.questionType,
        answerLines: q.answerLines,
      };
    })
    .filter(Boolean) as ProcessedQ[];

  const objetivas = allProcessed.filter((q) => q.questionType === "objetiva");
  const vf = allProcessed.filter((q) => q.questionType === "verdadeiro_falso");
  const dissertativas = allProcessed.filter((q) => q.questionType === "dissertativa");

  const sections: SectionDefinition[] = [];
  if (objetivas.length) sections.push({ key: "obj", title: "I. Questões Objetivas", layout: "two", qs: objetivas });
  if (vf.length) sections.push({
    key: "vf",
    title: `${sections.length === 0 ? "I" : "II"}. Questões de Verdadeiro ou Falso`,
    layout: "two",
    qs: vf,
  });
  if (dissertativas.length) {
    const numeral = sections.length === 0 ? "I" : sections.length === 1 ? "II" : "III";
    sections.push({
      key: "diss",
      title: `${numeral}. Questões Dissertativas`,
      layout: "single",
      qs: dissertativas,
    });
  }
  return sections;
}

function renderSet(
  set: ExamSet,
  exam: Exam,
  logoBuf: Buffer | null,
  gabaritoBuf: Buffer | null,
  targetTotalPages: number,
): React.ReactElement[] {
  const sections = prepareSetSections(set);
  const questionPages = buildQuestionPages(sections);

  // targetTotalPages = question pages + blank pads + 1 (gabarito, last)
  const blanksNeeded = Math.max(0, targetTotalPages - 1 - questionPages.length);

  const elements: React.ReactElement[] = questionPages.map((page, pageIndex) => (
    <Page key={`${set.id}-page-${pageIndex}`} size="A4" style={s.page}>
      <Text style={s.setLabel}>{set.label}</Text>
      <Header title={exam.title} institution={exam.institution} setLabel={set.label} logoBuf={logoBuf} />

      {page.segments.map((segment, segmentIndex) => (
        <React.Fragment key={`${set.id}-page-${pageIndex}-segment-${segmentIndex}`}>
          {segment.title && <SectionDivider title={segment.title} />}
          {segment.kind === "two" ? (
            <View style={s.columns}>
              <View style={s.column}>{segment.col1.map(renderQuestion)}</View>
              <View style={s.column}>{segment.col2.map(renderQuestion)}</View>
            </View>
          ) : (
            segment.qs.map(renderQuestion)
          )}
        </React.Fragment>
      ))}
    </Page>
  ));

  // Add blank pages to reach targetTotalPages - 1 (before the gabarito)
  for (let i = 0; i < blanksNeeded; i++) {
    elements.push(<Page key={`${set.id}-blank-${i}`} size="A4" style={s.blankPage}><View /></Page>);
  }

  // Gabarito always last
  elements.push(<AnswerKeyPage key={`${set.id}-ak`} gabaritoBuf={gabaritoBuf} />);
  return elements;
}

export function computeUniformTargetTotalPages(questionPageCounts: number[]): number {
  const maxQPages = Math.max(...questionPageCounts, 1);
  let targetTotal = maxQPages + 1;
  if (targetTotal % 2 !== 0) targetTotal += 1;
  return targetTotal;
}

export function ExamPdf({ exam }: { exam: Exam }) {
  const logoBuf = getLogoBuf();
  const gabaritoBuf = getGabaritoBuf(exam.id);
  const sets = [...exam.sets].sort((a, b) => a.label.localeCompare(b.label));

  // Two-pass: compute question page count per set, find max, compute uniform target
  const sectionsBySet = sets.map((set) => prepareSetSections(set));
  const questionPageCounts = sectionsBySet.map((sections) => buildQuestionPages(sections).length);
  const targetTotal = computeUniformTargetTotalPages(questionPageCounts);

  return (
    <Document>
      {sets.flatMap((set) => renderSet(set, exam, logoBuf, gabaritoBuf, targetTotal))}
    </Document>
  );
}

export async function renderExamPdf(exam: Exam): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const element = React.createElement(ExamPdf, { exam }) as React.ReactElement<DocumentProps>;
  return renderToBuffer(element) as Promise<Buffer>;
}

export function ExamSetPdf({ exam, setId }: { exam: Exam; setId: number }) {
  const logoBuf = getLogoBuf();
  const gabaritoBuf = getGabaritoBuf(exam.id);
  const sets = [...exam.sets].sort((a, b) => a.label.localeCompare(b.label));
  const targetSet = sets.find((set) => set.id === setId);
  if (!targetSet) return <Document />;

  const questionPageCounts = sets.map((set) => buildQuestionPages(prepareSetSections(set)).length);
  const targetTotal = computeUniformTargetTotalPages(questionPageCounts);

  return (
    <Document>
      {renderSet(targetSet, exam, logoBuf, gabaritoBuf, targetTotal)}
    </Document>
  );
}

export async function renderExamSetPdf(exam: Exam, setId: number): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const element = React.createElement(ExamSetPdf, { exam, setId }) as React.ReactElement<DocumentProps>;
  return renderToBuffer(element) as Promise<Buffer>;
}
