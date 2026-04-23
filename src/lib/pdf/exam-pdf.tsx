import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, type DocumentProps } from "@react-pdf/renderer";
import type { Exam, ExamSet, QuestionType } from "@/types";
import { getQuestion } from "@/lib/db/questions";
import fs from "fs";
import path from "path";

const LETTERS = ["A", "B", "C", "D", "E"];

// ── Image helpers ─────────────────────────────────────────────────────────────
function readBuf(p: string): Buffer | null {
  try { return fs.readFileSync(p); } catch { return null; }
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

// ── Layout constants ──────────────────────────────────────────────────────────
const PAGE_PADDING = 42.52;
const PAGE_H = 841.89;
const HEADER_H = 52;
const SECTION_DIVIDER_H = 28;
const AVAILABLE_COL_H = PAGE_H - PAGE_PADDING * 2 - HEADER_H;
const CHARS_PER_LINE = 40;
const CHARS_PER_OPT_LINE = 42;
const BLANK_LINE_H = 18;

// ── Height estimators ─────────────────────────────────────────────────────────
function estimateH(statement: string, options: string[]): number {
  const statLines = Math.max(1, Math.ceil(statement.length / CHARS_PER_LINE));
  const statH = (1 + statLines) * 14;
  const optH = options.reduce((s, o) => s + Math.ceil(o.length / CHARS_PER_OPT_LINE) * 13, 0);
  return statH + optH + 14;
}

function estimateVFH(statement: string): number {
  const statLines = Math.max(1, Math.ceil(statement.length / CHARS_PER_LINE));
  return (1 + statLines) * 14 + 2 * 13 + 14; // statement + 2 option rows + margin
}

function estimateDissertativaH(statement: string, answerLines: number): number {
  const statLines = Math.max(1, Math.ceil(statement.length / (CHARS_PER_LINE * 2))); // single col = double width
  return (1 + statLines) * 14 + (answerLines || 5) * BLANK_LINE_H + 20;
}

// ── Group into two-column pages ────────────────────────────────────────────────
interface ColPage { col1: ProcessedQ[]; col2: ProcessedQ[] }

interface ProcessedQ {
  id: number;
  statement: string;
  options: { text: string }[];
  shuffledOptions: number[];
  imageBuf: Buffer | null;
  questionType: QuestionType;
  answerLines: number;
}

function groupIntoPages(qs: ProcessedQ[], firstPageBudget = AVAILABLE_COL_H): ColPage[] {
  const pages: ColPage[] = [];
  let col1: ProcessedQ[] = [], col2: ProcessedQ[] = [];
  let h1 = 0, h2 = 0;
  const budget = (pgIdx: number) => pgIdx === 0 ? firstPageBudget : AVAILABLE_COL_H;
  let pgIdx = 0;

  for (const q of qs) {
    const h = q.questionType === "verdadeiro_falso"
      ? estimateVFH(q.statement)
      : estimateH(q.statement, q.options.map((o) => o.text));
    const bud = budget(pgIdx);
    if (h1 + h <= bud) {
      col1.push(q); h1 += h;
    } else if (h2 + h <= bud) {
      col2.push(q); h2 += h;
    } else {
      pages.push({ col1, col2 });
      pgIdx++;
      col1 = [q]; col2 = []; h1 = h; h2 = 0;
    }
  }
  if (col1.length || col2.length) pages.push({ col1, col2 });
  return pages;
}

function groupIntoSingleColumnPages(qs: ProcessedQ[], firstPageBudget = AVAILABLE_COL_H): ProcessedQ[][] {
  const pages: ProcessedQ[][] = [];
  let current: ProcessedQ[] = [];
  let h = 0;
  let pgIdx = 0;
  const budget = (i: number) => i === 0 ? firstPageBudget : AVAILABLE_COL_H;

  for (const q of qs) {
    const qh = estimateDissertativaH(q.statement, q.answerLines);
    if (h + qh <= budget(pgIdx)) {
      current.push(q); h += qh;
    } else {
      if (current.length) { pages.push(current); pgIdx++; }
      current = [q]; h = qh;
    }
  }
  if (current.length) pages.push(current);
  return pages;
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  columns: { flexDirection: "row", gap: 16 },
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
});

// ── Header block ──────────────────────────────────────────────────────────────
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

// ── Section divider ───────────────────────────────────────────────────────────
function SectionDivider({ title }: { title: string }) {
  return (
    <View style={s.sectionDivider}>
      <Text style={s.sectionDividerText}>{title}</Text>
    </View>
  );
}

// ── Question renderers ────────────────────────────────────────────────────────
function QuestionView({ q, globalIdx }: { q: ProcessedQ; globalIdx: number }) {
  return (
    <View style={s.question}>
      <View style={s.qHeader}>
        <Text style={s.qNum}>{globalIdx}.</Text>
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

function VFQuestionView({ q, globalIdx }: { q: ProcessedQ; globalIdx: number }) {
  // shuffledOptions is [0,1] or [1,0]; origIdx 0=Verdadeiro, 1=Falso
  const labels = ["Verdadeiro", "Falso"];
  const opts = q.shuffledOptions.length === 2 ? q.shuffledOptions : [0, 1];
  return (
    <View style={s.question}>
      <View style={s.qHeader}>
        <Text style={s.qNum}>{globalIdx}.</Text>
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

function DissertativaQuestionView({ q, globalIdx }: { q: ProcessedQ; globalIdx: number }) {
  const lines = q.answerLines > 0 ? q.answerLines : 5;
  return (
    <View style={s.question}>
      <View style={s.qHeader}>
        <Text style={s.qNum}>{globalIdx}.</Text>
        <Text style={s.statement}>{q.statement}</Text>
      </View>
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={s.blankLine} />
      ))}
    </View>
  );
}

// ── Answer key page ───────────────────────────────────────────────────────────
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

// ── Section renderer helpers ──────────────────────────────────────────────────
interface SectionProps {
  setId: number;
  sectionKey: string;
  sectionTitle: string;
  qs: ProcessedQ[];
  startGlobalQ: number;
  isSingleColumn: boolean;
  set: ExamSet;
  exam: Exam;
  logoBuf: Buffer | null;
}

function renderTwoColumnSection({ setId, sectionKey, sectionTitle, qs, startGlobalQ, set, exam, logoBuf }: SectionProps): { els: React.ReactElement[]; finalGlobalQ: number } {
  const firstBudget = AVAILABLE_COL_H - SECTION_DIVIDER_H;
  const pages = groupIntoPages(qs, firstBudget);
  const els: React.ReactElement[] = [];
  let globalQ = startGlobalQ;

  pages.forEach((pg, pi) => {
    els.push(
      <Page key={`${setId}-${sectionKey}-p${pi}`} size="A4" style={s.page}>
        <Text style={s.setLabel}>{set.label}</Text>
        <Header title={exam.title} institution={exam.institution} setLabel={set.label} logoBuf={logoBuf} />
        {pi === 0 && <SectionDivider title={sectionTitle} />}
        <View style={s.columns}>
          <View style={s.column}>
            {pg.col1.map((q) => {
              globalQ++;
              return q.questionType === "verdadeiro_falso"
                ? <VFQuestionView key={q.id} q={q} globalIdx={globalQ} />
                : <QuestionView key={q.id} q={q} globalIdx={globalQ} />;
            })}
          </View>
          <View style={s.column}>
            {pg.col2.map((q) => {
              globalQ++;
              return q.questionType === "verdadeiro_falso"
                ? <VFQuestionView key={q.id} q={q} globalIdx={globalQ} />
                : <QuestionView key={q.id} q={q} globalIdx={globalQ} />;
            })}
          </View>
        </View>
      </Page>
    );
  });
  return { els, finalGlobalQ: globalQ };
}

function renderSingleColumnSection({ setId, sectionKey, sectionTitle, qs, startGlobalQ, set, exam, logoBuf }: SectionProps): { els: React.ReactElement[]; finalGlobalQ: number } {
  const firstBudget = AVAILABLE_COL_H - SECTION_DIVIDER_H;
  const pages = groupIntoSingleColumnPages(qs, firstBudget);
  const els: React.ReactElement[] = [];
  let globalQ = startGlobalQ;

  pages.forEach((page, pi) => {
    els.push(
      <Page key={`${setId}-${sectionKey}-p${pi}`} size="A4" style={s.page}>
        <Text style={s.setLabel}>{set.label}</Text>
        <Header title={exam.title} institution={exam.institution} setLabel={set.label} logoBuf={logoBuf} />
        {pi === 0 && <SectionDivider title={sectionTitle} />}
        {page.map((q) => {
          globalQ++;
          return <DissertativaQuestionView key={q.id} q={q} globalIdx={globalQ} />;
        })}
      </Page>
    );
  });
  return { els, finalGlobalQ: globalQ };
}

// ── Main set renderer ─────────────────────────────────────────────────────────
function renderSet(set: ExamSet, exam: Exam, logoBuf: Buffer | null, gabaritoBuf: Buffer | null): React.ReactElement[] {
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

  const els: React.ReactElement[] = [];
  let globalQ = 0;
  let totalPages = 0;

  const sectionProps = { setId: set.id, set, exam, logoBuf, isSingleColumn: false };

  if (objetivas.length) {
    const sectionNum = "I";
    const { els: sEls, finalGlobalQ } = renderTwoColumnSection({ ...sectionProps, sectionKey: "obj", sectionTitle: `${sectionNum}. Questões Objetivas`, qs: objetivas, startGlobalQ: globalQ });
    els.push(...sEls);
    globalQ = finalGlobalQ;
    totalPages += sEls.length;
  }

  if (vf.length) {
    const sectionNum = objetivas.length ? "II" : "I";
    const { els: sEls, finalGlobalQ } = renderTwoColumnSection({ ...sectionProps, sectionKey: "vf", sectionTitle: `${sectionNum}. Questões de Verdadeiro ou Falso`, qs: vf, startGlobalQ: globalQ });
    els.push(...sEls);
    globalQ = finalGlobalQ;
    totalPages += sEls.length;
  }

  if (dissertativas.length) {
    const filled = (objetivas.length ? 1 : 0) + (vf.length ? 1 : 0);
    const sectionNum = filled === 2 ? "III" : filled === 1 ? "II" : "I";
    const { els: sEls, finalGlobalQ } = renderSingleColumnSection({ ...sectionProps, sectionKey: "diss", sectionTitle: `${sectionNum}. Questões Dissertativas`, qs: dissertativas, startGlobalQ: globalQ, isSingleColumn: true });
    els.push(...sEls);
    globalQ = finalGlobalQ;
    totalPages += sEls.length;
  }

  // Even-page guarantee (question pages + answer key = even total for double-sided)
  if (totalPages % 2 === 0) {
    els.push(<Page key={`${set.id}-blank`} size="A4" style={s.page}><View /></Page>);
  }

  els.push(<AnswerKeyPage key={`${set.id}-ak`} gabaritoBuf={gabaritoBuf} />);
  return els;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function ExamPdf({ exam }: { exam: Exam }) {
  const logoBuf = getLogoBuf();
  const gabaritoBuf = getGabaritoBuf(exam.id);
  const sets = [...exam.sets].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Document>
      {sets.flatMap((set) => renderSet(set, exam, logoBuf, gabaritoBuf))}
    </Document>
  );
}

export async function renderExamPdf(exam: Exam): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const element = React.createElement(ExamPdf, { exam }) as React.ReactElement<DocumentProps>;
  return renderToBuffer(element) as Promise<Buffer>;
}
