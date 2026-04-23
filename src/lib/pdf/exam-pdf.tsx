import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, type DocumentProps } from "@react-pdf/renderer";
import type { Exam, ExamSet } from "@/types";
import { getQuestion } from "@/lib/db/questions";
import fs from "fs";
import path from "path";

const LETTERS = ["A", "B", "C", "D", "E"];

// ── Image helpers (Buffer avoids Windows path issues in react-pdf) ─────────────
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

// ── Layout constants (all in pt, 1cm ≈ 28.35pt) ──────────────────────────────
const PAGE_PADDING = 42.52; // 1.5cm
const PAGE_H = 841.89; // A4 height
const HEADER_H = 52; // estimated header block height
const AVAILABLE_COL_H = PAGE_H - PAGE_PADDING * 2 - HEADER_H; // ~706pt per column
const CHARS_PER_LINE = 40; // chars per column line (Helvetica 10pt)
const CHARS_PER_OPT_LINE = 42;

// ── Height estimator (per question) ──────────────────────────────────────────
function estimateH(statement: string, options: string[]): number {
  const statLines = Math.max(1, Math.ceil(statement.length / CHARS_PER_LINE));
  const statH = (1 + statLines) * 14; // 10pt × lineHeight 1.4
  const optH = options.reduce((s, o) => s + Math.ceil(o.length / CHARS_PER_OPT_LINE) * 13, 0);
  return statH + optH + 14; // 14pt bottom margin
}

// ── Group questions into pages ────────────────────────────────────────────────
interface ColPage { col1: ProcessedQ[]; col2: ProcessedQ[] }

interface ProcessedQ {
  id: number;
  statement: string;
  options: { text: string }[];
  shuffledOptions: number[];
  imageBuf: Buffer | null;
}

function groupIntoPages(qs: ProcessedQ[]): ColPage[] {
  const pages: ColPage[] = [];
  let col1: ProcessedQ[] = [], col2: ProcessedQ[] = [];
  let h1 = 0, h2 = 0;

  for (const q of qs) {
    const h = estimateH(q.statement, q.options.map((o) => o.text));
    if (h1 + h <= AVAILABLE_COL_H) {
      col1.push(q); h1 += h;
    } else if (h2 + h <= AVAILABLE_COL_H) {
      col2.push(q); h2 += h;
    } else {
      pages.push({ col1, col2 });
      col1 = [q]; col2 = []; h1 = h; h2 = 0;
    }
  }
  if (col1.length || col2.length) pages.push({ col1, col2 });
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
  akPage: { padding: PAGE_PADDING, backgroundColor: "#ffffff" },
  akImageWrap: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: PAGE_PADDING },
});

// ── Header block ─────────────────────────────────────────────────────────────
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

// ── Question renderer ─────────────────────────────────────────────────────────
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

// ── Answer key page ───────────────────────────────────────────────────────────
// Image: 1/4 of A4 width (595pt), centered, anchored to bottom with padding
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

// ── Main component ────────────────────────────────────────────────────────────
function renderSet(set: ExamSet, exam: Exam, logoBuf: Buffer | null, gabaritoBuf: Buffer | null): React.ReactElement[] {
  const processed: ProcessedQ[] = set.questions
    .sort((a, b) => a.position - b.position)
    .map((sq) => {
      const q = getQuestion(sq.questionId);
      if (!q) return null;
      let imageBuf: Buffer | null = null;
      if (q.imageUrl) {
        imageBuf = readBuf(path.join(process.cwd(), "public", q.imageUrl.replace(/^\//, "")));
      }
      return { id: q.id, statement: q.statement, options: q.options, shuffledOptions: sq.shuffledOptions, imageBuf };
    })
    .filter(Boolean) as ProcessedQ[];

  const pages = groupIntoPages(processed);
  const questionPages = pages.length;
  // Even-page guarantee per set for double-sided stapling:
  // odd questionPages + 1 answer key = even ✓
  // even questionPages + 1 blank + 1 answer key = even ✓
  const needBlank = questionPages % 2 === 0;

  const els: React.ReactElement[] = [];

  let globalQ = 0;
  pages.forEach((pg, pi) => {
    els.push(
      <Page key={`${set.id}-p${pi}`} size="A4" style={s.page}>
        <Text style={s.setLabel}>{set.label}</Text>
        <Header title={exam.title} institution={exam.institution} setLabel={set.label} logoBuf={logoBuf} />
        <View style={s.columns}>
          <View style={s.column}>
            {pg.col1.map((q) => { globalQ++; return <QuestionView key={q.id} q={q} globalIdx={globalQ} />; })}
          </View>
          <View style={s.column}>
            {pg.col2.map((q) => { globalQ++; return <QuestionView key={q.id} q={q} globalIdx={globalQ} />; })}
          </View>
        </View>
      </Page>
    );
  });

  if (needBlank) {
    els.push(<Page key={`${set.id}-blank`} size="A4" style={s.page}><View /></Page>);
  }

  els.push(<AnswerKeyPage key={`${set.id}-ak`} gabaritoBuf={gabaritoBuf} />);

  return els;
}

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
