import sharp from "sharp";
import type { QuestionOption, QuestionType } from "@/types";
import { truncateRichTextPlain } from "@/lib/html/rich-text";

const IMAGE_WIDTH = 1400;
const PAGE_MARGIN = 72;
const CONTENT_WIDTH = IMAGE_WIDTH - (PAGE_MARGIN * 2);
const LETTERS = ["A", "B", "C", "D", "E"];

export interface AnswerKeyImageQuestion {
  position: number;
  sourceQuestionId: number;
  statementHtml: string;
  questionType: QuestionType;
  options: QuestionOption[];
  shuffledOptions: number[];
  correctShuffledIndex: number;
  correctAnswer: string;
  explanation: string;
}

export interface AnswerKeyImageInput {
  examTitle: string;
  institution: string;
  setLabel: string;
  versionNumber?: number;
  questions: AnswerKeyImageQuestion[];
}

interface PreparedQuestion extends AnswerKeyImageQuestion {
  typeLabel: string;
  statementLines: string[];
  answerLines: string[];
  explanationLines: string[];
  height: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|lt|gt|quot|apos|#39|nbsp);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    if (normalized === "quot") return '"';
    if (normalized === "apos" || normalized === "#39") return "'";
    if (normalized === "nbsp") return " ";
    const numeric = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    return Number.isSafeInteger(numeric) && numeric >= 0 ? String.fromCodePoint(numeric) : entity;
  });
}

function richTextPlain(value: string, maxLength: number): string {
  return decodeHtmlEntities(truncateRichTextPlain(value, maxLength)).replace(/\s+/g, " ").trim();
}

function plainText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function wrapText(value: string, maxCharacters: number): string[] {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const chunks = normalized.split(" ").flatMap((word) => {
    if (word.length <= maxCharacters) return [word];
    const parts: string[] = [];
    for (let offset = 0; offset < word.length; offset += maxCharacters) {
      parts.push(word.slice(offset, offset + maxCharacters));
    }
    return parts;
  });
  const lines: string[] = [];
  let current = "";
  for (const word of chunks) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function typeLabel(type: QuestionType): string {
  if (type === "objetiva") return "OBJETIVA";
  if (type === "verdadeiro_falso") return "TRUE / FALSE";
  if (type === "numerica") return "NUMÉRICA";
  return "DISSERTATIVA";
}

export function resolveAnswerKeyImageAnswer(question: AnswerKeyImageQuestion): string {
  if (question.questionType === "dissertativa") {
    return "Resposta dissertativa — consulte a justificativa abaixo.";
  }
  if (question.questionType === "numerica") {
    return question.correctAnswer.trim() || "Resposta numérica não cadastrada";
  }
  if (question.questionType === "verdadeiro_falso") {
    const originalIndex = question.shuffledOptions[question.correctShuffledIndex];
    if (originalIndex === 0) return "True";
    if (originalIndex === 1) return "False";
    return "Resposta não cadastrada";
  }

  const displayedIndex = question.correctShuffledIndex;
  const originalIndex = question.shuffledOptions[displayedIndex];
  const correctOption = question.options.find((option) => option.index === originalIndex);
  const letter = LETTERS[displayedIndex] ?? "?";
  const optionText = correctOption ? plainText(correctOption.text, 260) : "alternativa não encontrada";
  return `${letter} — ${optionText}`;
}

function prepareQuestion(question: AnswerKeyImageQuestion): PreparedQuestion {
  const statement = richTextPlain(question.statementHtml, 520) || `Questão do banco #${question.sourceQuestionId}`;
  const explanation = richTextPlain(question.explanation, 1800) || "Sem justificativa cadastrada.";
  const statementLines = wrapText(statement, 92);
  const answerLines = wrapText(resolveAnswerKeyImageAnswer(question), 78);
  const explanationLines = wrapText(explanation, 91);
  const height = 331
    + (statementLines.length * 34)
    + (answerLines.length * 31)
    + (Math.max(0, explanationLines.length - 1) * 31);

  return {
    ...question,
    typeLabel: typeLabel(question.questionType),
    statementLines,
    answerLines,
    explanationLines,
    height,
  };
}

function textLines(lines: string[], x: number, y: number, lineHeight: number, className: string): string {
  return `<text x="${x}" y="${y}" class="${className}">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join("")}</text>`;
}

export function buildAnswerKeySvg(input: AnswerKeyImageInput): { svg: string; width: number; height: number } {
  const titleLines = wrapText(plainText(input.examTitle, 180) || "Gabarito", 54);
  const prepared = [...input.questions]
    .sort((a, b) => a.position - b.position || a.sourceQuestionId - b.sourceQuestionId)
    .map(prepareQuestion);
  const headerHeight = 194 + (titleLines.length * 54);
  const cardsHeight = prepared.reduce((total, question) => total + question.height, 0);
  const cardsGap = Math.max(0, prepared.length - 1) * 28;
  const emptyHeight = prepared.length === 0 ? 190 : 0;
  const imageHeight = headerHeight + 42 + cardsHeight + cardsGap + emptyHeight + 112;
  const meta = [
    input.institution.trim(),
    `Set ${input.setLabel}`,
    input.versionNumber ? `Versão ${input.versionNumber}` : "Versão atual",
    `${prepared.length} ${prepared.length === 1 ? "questão" : "questões"}`,
  ].filter(Boolean).join("  •  ");

  let y = headerHeight + 42;
  const cards = prepared.map((question) => {
    const cardY = y;
    const cardX = PAGE_MARGIN;
    const innerX = cardX + 42;
    const cardWidth = CONTENT_WIDTH;
    const statementY = cardY + 116;
    const answerBoxY = statementY + (question.statementLines.length * 34) + 20;
    const answerBoxHeight = 55 + (question.answerLines.length * 31);
    const explanationLabelY = answerBoxY + answerBoxHeight + 48;
    const explanationY = explanationLabelY + 42;
    y += question.height + 28;

    return `
      <g>
        <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${question.height}" rx="26" fill="#ffffff" stroke="#dbe4ee" stroke-width="2"/>
        <circle cx="${innerX + 25}" cy="${cardY + 49}" r="25" fill="#f59e0b"/>
        <text x="${innerX + 25}" y="${cardY + 58}" text-anchor="middle" class="question-number">${question.position}</text>
        <text x="${innerX + 70}" y="${cardY + 56}" class="question-meta">${escapeXml(question.typeLabel)}  •  BANCO #${question.sourceQuestionId}</text>
        ${textLines(question.statementLines, innerX, statementY, 34, "statement")}
        <rect x="${innerX}" y="${answerBoxY}" width="${cardWidth - 84}" height="${answerBoxHeight}" rx="16" fill="#eaf8ef"/>
        <text x="${innerX + 22}" y="${answerBoxY + 25}" class="answer-label">RESPOSTA CORRETA</text>
        ${textLines(question.answerLines, innerX + 22, answerBoxY + 62, 31, "answer")}
        <text x="${innerX}" y="${explanationLabelY}" class="explanation-label">JUSTIFICATIVA</text>
        ${textLines(question.explanationLines, innerX, explanationY, 31, "explanation")}
      </g>`;
  }).join("");

  const emptyState = prepared.length === 0
    ? `<rect x="${PAGE_MARGIN}" y="${y}" width="${CONTENT_WIDTH}" height="160" rx="24" fill="#ffffff" stroke="#dbe4ee" stroke-width="2"/>
       <text x="${IMAGE_WIDTH / 2}" y="${y + 92}" text-anchor="middle" class="empty">Nenhuma questão encontrada neste set.</text>`
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${imageHeight}" viewBox="0 0 ${IMAGE_WIDTH} ${imageHeight}">
    <style>
      text { font-family: Arial, "Helvetica Neue", sans-serif; }
      .brand { fill: #fbbf24; font-size: 25px; font-weight: 700; letter-spacing: 2px; }
      .title { fill: #ffffff; font-size: 47px; font-weight: 700; }
      .meta { fill: #d8e7f1; font-size: 23px; }
      .question-number { fill: #ffffff; font-size: 26px; font-weight: 700; }
      .question-meta { fill: #476072; font-size: 22px; font-weight: 700; letter-spacing: 1px; }
      .statement { fill: #172b3a; font-size: 25px; font-weight: 600; }
      .answer-label { fill: #237a48; font-size: 17px; font-weight: 700; letter-spacing: 1px; }
      .answer { fill: #14532d; font-size: 23px; font-weight: 700; }
      .explanation-label { fill: #31566f; font-size: 18px; font-weight: 700; letter-spacing: 1px; }
      .explanation { fill: #334b5c; font-size: 23px; }
      .empty { fill: #64748b; font-size: 25px; }
      .footer { fill: #718596; font-size: 19px; }
    </style>
    <rect width="${IMAGE_WIDTH}" height="${imageHeight}" fill="#f3f6fa"/>
    <rect width="${IMAGE_WIDTH}" height="${headerHeight}" fill="#123b53"/>
    <rect width="14" height="${headerHeight}" fill="#f59e0b"/>
    <text x="${PAGE_MARGIN}" y="62" class="brand">UNIFIL EXAMS  •  GABARITO COMENTADO</text>
    ${textLines(titleLines, PAGE_MARGIN, 124, 54, "title")}
    <text x="${PAGE_MARGIN}" y="${headerHeight - 42}" class="meta">${escapeXml(meta)}</text>
    ${cards}
    ${emptyState}
    <line x1="${PAGE_MARGIN}" y1="${imageHeight - 78}" x2="${IMAGE_WIDTH - PAGE_MARGIN}" y2="${imageHeight - 78}" stroke="#d5dee7" stroke-width="2"/>
    <text x="${PAGE_MARGIN}" y="${imageHeight - 39}" class="footer">Gabarito comentado • confira a identificação do set antes da correção</text>
  </svg>`;

  return { svg, width: IMAGE_WIDTH, height: imageHeight };
}

export async function renderAnswerKeyPng(input: AnswerKeyImageInput): Promise<Buffer> {
  const { svg } = buildAnswerKeySvg(input);
  return sharp(Buffer.from(svg, "utf8"), { density: 144 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}
