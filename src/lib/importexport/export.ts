import type { Question } from "@/types";
import type { ExportedQuestion, QuestionExportFile } from "./types";

function questionToExported(q: Question): ExportedQuestion {
  return {
    statement: q.statement,
    questionType: q.questionType,
    options: q.options.map((o) => o.text),
    correctIndex: q.correctIndex,
    difficulty: q.difficulty,
    thematicArea: q.thematicArea ?? null,
    explanation: q.explanation,
    answerLines: q.answerLines,
  };
}

export function questionsToJson(questions: Question[]): string {
  const file: QuestionExportFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    questions: questions.map(questionToExported),
  };
  return JSON.stringify(file, null, 2);
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function questionsToCsv(questions: Question[]): string {
  const header = "statement,question_type,difficulty,option_a,option_b,option_c,option_d,option_e,correct_index,thematic_area,answer_lines";
  const rows = questions.map((q) => {
    const opts = q.options.map((o) => o.text);
    // Pad to 5 slots (V/F has 2, dissertativa has 0)
    const [a, b, c, d, e] = [opts[0] ?? "", opts[1] ?? "", opts[2] ?? "", opts[3] ?? "", opts[4] ?? ""];
    return [
      escapeCsv(q.statement),
      q.questionType,
      q.difficulty,
      escapeCsv(a),
      escapeCsv(b),
      escapeCsv(c),
      escapeCsv(d),
      escapeCsv(e),
      String(q.correctIndex),
      escapeCsv(q.thematicArea ?? ""),
      String(q.answerLines),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}
