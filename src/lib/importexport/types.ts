import { z } from "zod";

export const ExportedQuestionSchema = z.object({
  statement: z.string().min(1),
  questionType: z.enum(["objetiva", "verdadeiro_falso", "dissertativa"]).default("objetiva"),
  options: z.array(z.string()).default([]),
  correctIndex: z.number().int().min(0).max(4).default(0),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  thematicArea: z.string().nullable().optional(),
  explanation: z.string().default(""),
  answerLines: z.number().int().min(0).default(0),
});

export const QuestionExportFileSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  questions: z.array(ExportedQuestionSchema).min(1),
});

export type ExportedQuestion = z.infer<typeof ExportedQuestionSchema>;
export type QuestionExportFile = z.infer<typeof QuestionExportFileSchema>;

// RFC-4180 compliant CSV parser (handles quoted fields with commas/newlines)
export function parseCsvQuestions(csvText: string): ExportedQuestion[] {
  const lines = splitCsvRows(csvText.trim());
  if (lines.length < 2) return [];

  const rows = lines.slice(1); // skip header
  const results: ExportedQuestion[] = [];

  for (const row of rows) {
    if (!row.trim()) continue;
    const cells = parseCsvRow(row);
    const [statement, questionType, difficulty, optA, optB, optC, optD, optE, correctIndexRaw, thematicArea, answerLinesRaw, explanationRaw] = cells;

    const options: string[] = [optA, optB, optC, optD, optE].filter(Boolean);
    const parsed = ExportedQuestionSchema.safeParse({
      statement: statement ?? "",
      questionType: questionType || "objetiva",
      options,
      correctIndex: Number(correctIndexRaw ?? 0),
      difficulty: difficulty || "medium",
      thematicArea: thematicArea || null,
      explanation: explanationRaw ?? "",
      answerLines: Number(answerLinesRaw ?? 0),
    });
    if (parsed.success) results.push(parsed.data);
  }
  return results;
}

function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { current += '""'; i++; }
      else { inQuote = !inQuote; current += ch; }
    } else if (ch === "\n" && !inQuote) {
      rows.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) rows.push(current);
  return rows;
}

function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuote && row[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}
