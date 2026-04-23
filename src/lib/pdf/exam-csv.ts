import type { ExamSet } from "@/types";
import { getQuestion } from "@/lib/db/questions";

const LETTERS = ["A", "B", "C", "D", "E"];

export function buildAnswerKeyCsv(examTitle: string, set: ExamSet): string {
  const rows: string[] = [`"Prova","${examTitle} — Set ${set.label}"`];
  rows.push(`"Questão","Alternativa Correta"`);

  const sorted = [...set.questions].sort((a, b) => a.position - b.position);
  sorted.forEach((sq, idx) => {
    const q = getQuestion(sq.questionId);
    const letter = LETTERS[sq.correctShuffledIndex] ?? "?";
    const stmt = q ? `"${q.statement.slice(0, 60).replace(/"/g, '""')}…"` : `"Q${sq.questionId}"`;
    rows.push(`${idx + 1},${letter},${stmt}`);
  });

  return rows.join("\n");
}
