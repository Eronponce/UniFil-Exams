import type { Exam, ExamSet } from "@/types";
import { getQuestion } from "@/lib/db/questions";
import { truncateRichTextPlain } from "@/lib/html/rich-text";

const LETTERS = ["A", "B", "C", "D", "E"];

function resolveAnswer(sq: { shuffledOptions: number[]; correctShuffledIndex: number }, questionType: string, correctAnswer?: string): string {
  if (questionType === "dissertativa") return "-";
  if (questionType === "numerica") return correctAnswer || "-";
  if (questionType === "verdadeiro_falso") {
    // shuffledOptions[correctShuffledIndex] gives the original index: 0=Verdadeiro, 1=Falso
    const origIdx = sq.shuffledOptions[sq.correctShuffledIndex];
    return origIdx === 0 ? "V" : "F";
  }
  return LETTERS[sq.correctShuffledIndex] ?? "?";
}

export function buildAnswerKeyCsv(examTitle: string, set: ExamSet): string {
  const rows: string[] = [`"Prova","${examTitle} — Set ${set.label}"`];
  rows.push(`"Questão","Resposta","Enunciado"`);

  const sorted = [...set.questions].sort((a, b) => a.position - b.position);
  sorted.forEach((sq, idx) => {
    const q = getQuestion(sq.questionId);
    const answer = q ? resolveAnswer(sq, q.questionType, q.correctAnswer) : "?";
    const stmt = q ? `"${truncateRichTextPlain(q.statement, 60).replace(/"/g, '""')}"` : `"Q${sq.questionId}"`;
    rows.push(`${idx + 1},${answer},${stmt}`);
  });

  return rows.join("\n");
}

function resolveAnswerMatrix(sq: { shuffledOptions: number[]; correctShuffledIndex: number }, questionType: string, correctAnswer?: string): string {
  if (questionType === "dissertativa") return "";
  if (questionType === "numerica") return correctAnswer ?? "";
  if (questionType === "verdadeiro_falso") {
    const origIdx = sq.shuffledOptions[sq.correctShuffledIndex];
    return origIdx === 0 ? "True" : "False";
  }
  return LETTERS[sq.correctShuffledIndex] ?? "?";
}

export function buildAnswerKeyMatrixCsv(exam: Exam): string {
  if (exam.sets.length === 0) return "";

  const numQuestions = exam.sets[0]!.questions.length;

  // Header: "Núm. P","Tipo de prova A","Tipo de prova B",...
  const header = [
    `"Núm. P"`,
    ...exam.sets.map((s) => `"Tipo de prova ${s.label}"`),
  ].join(",");

  const rows: string[] = [header];

  for (let pos = 1; pos <= numQuestions; pos++) {
    const cells: string[] = [`"${pos}"`];
    for (const set of exam.sets) {
      const sq = [...set.questions].sort((a, b) => a.position - b.position)[pos - 1];
      if (!sq) { cells.push(`""`); continue; }
      const q = getQuestion(sq.questionId);
      const answer = q ? resolveAnswerMatrix(sq, q.questionType, q.correctAnswer) : "";
      cells.push(`"${answer}"`);
    }
    rows.push(cells.join(","));
  }

  return rows.join("\n");
}
