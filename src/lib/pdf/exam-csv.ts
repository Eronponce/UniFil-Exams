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

const TRACE_HEADERS = [
  "chave_rastreabilidade",
  "id_prova",
  "titulo_prova",
  "id_set",
  "versao_set",
  "posicao_exibida",
  "id_questao_banco",
  "tipo_questao",
  "area_tematica",
  "resposta_correta_exibida",
  "indice_correto_original",
  "ordem_original_alternativas_embaralhadas",
  "enunciado_resumido",
];

function escapeCsvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildCsvRow(values: Array<string | number | null | undefined>): string {
  return values.map(escapeCsvCell).join(",");
}

function compareSetOrder(a: ExamSet, b: ExamSet): number {
  return a.label.localeCompare(b.label, "pt-BR") || a.id - b.id;
}

function resolveTraceAnswer(
  sq: { shuffledOptions: number[]; correctShuffledIndex: number },
  questionType: string,
  correctAnswer: string,
): string {
  if (questionType === "dissertativa") return "";
  if (questionType === "numerica") return correctAnswer;
  if (questionType === "verdadeiro_falso") {
    const originalIndex = sq.shuffledOptions[sq.correctShuffledIndex];
    if (originalIndex === 0) return "V";
    if (originalIndex === 1) return "F";
    return "";
  }
  return LETTERS[sq.correctShuffledIndex] ?? "";
}

/** Builds the long-form CSV used to cross printed EvalBee positions with DB IDs. */
export function buildExamTraceCsv(exam: Exam): string {
  const rows = [buildCsvRow(TRACE_HEADERS)];
  const sets = [...exam.sets].sort(compareSetOrder);

  for (const set of sets) {
    const questions = [...set.questions].sort((a, b) => a.position - b.position || a.questionId - b.questionId);
    questions.forEach((sq, index) => {
      const displayedPosition = Number.isFinite(sq.position) ? sq.position + 1 : index + 1;
      const question = getQuestion(sq.questionId);
      const statement = question
        ? truncateRichTextPlain(question.statement, 160)
        : `[Questão ausente no banco: ID ${sq.questionId}]`;
      const questionType = question?.questionType ?? "ausente";
      const thematicArea = question?.thematicArea ?? "";
      const answer = question
        ? resolveTraceAnswer(sq, question.questionType, question.correctAnswer)
        : "";

      rows.push(buildCsvRow([
        `${exam.id}:${set.label}:${displayedPosition}`,
        exam.id,
        exam.title,
        set.id,
        set.label,
        displayedPosition,
        sq.questionId,
        questionType,
        thematicArea,
        answer,
        question?.correctIndex ?? "",
        Array.isArray(sq.shuffledOptions) ? JSON.stringify(sq.shuffledOptions) : "",
        statement,
      ]));
    });
  }

  return rows.join("\r\n");
}
