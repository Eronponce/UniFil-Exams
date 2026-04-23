import type { ExamSet } from "@/types";
import { getQuestion } from "@/lib/db/questions";

const LETTERS = ["A", "B", "C", "D", "E"];

function resolveAnswer(sq: { shuffledOptions: number[]; correctShuffledIndex: number }, questionType: string): string {
  if (questionType === "dissertativa") return "Dissertativa";
  if (questionType === "verdadeiro_falso") {
    // shuffledOptions[correctShuffledIndex] gives the original index: 0=Verdadeiro, 1=Falso
    const origIdx = sq.shuffledOptions[sq.correctShuffledIndex];
    return origIdx === 0 ? "V" : "F";
  }
  return LETTERS[sq.correctShuffledIndex] ?? "?";
}

export function buildAnswerKeyCsv(examTitle: string, set: ExamSet): string {
  const rows: string[] = [`"Prova","${examTitle} — Set ${set.label}"`];
  rows.push(`"Questão","Alternativa Correta"`);

  const sorted = [...set.questions].sort((a, b) => a.position - b.position);
  sorted.forEach((sq, idx) => {
    const q = getQuestion(sq.questionId);
    const answer = q ? resolveAnswer(sq, q.questionType) : "?";
    const stmt = q ? `"${q.statement.slice(0, 60).replace(/"/g, '""')}…"` : `"Q${sq.questionId}"`;
    rows.push(`${idx + 1},${answer},${stmt}`);
  });

  return rows.join("\n");
}
