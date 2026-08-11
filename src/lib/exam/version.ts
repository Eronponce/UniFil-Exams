import type { Exam, ExamQuestionLayouts, Question, QuestionLayout, QuestionOption, QuestionType } from "@/types";
import { sanitizeRichText } from "@/lib/html/rich-text";
import { normalizeExamInstructions } from "./instructions";
import { normalizeExamQuestionLayouts, normalizeQuestionLayout } from "./layout";

export const EXAM_VERSION_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface ExamVersionSnapshotQuestion {
  sourceQuestionId: number;
  sourceSetId: number;
  position: number;
  statementHtml: string;
  imageUrl: string | null;
  options: QuestionOption[];
  shuffledOptions: number[];
  correctShuffledIndex: number;
  questionType: QuestionType;
  answerLines: number;
  layoutOverride: QuestionLayout | null;
  layout: QuestionLayout;
  difficulty: Question["difficulty"];
  thematicArea: string | null;
  correctIndex: number;
  correctAnswer: string;
  explanation: string;
}

export interface ExamVersionSnapshotSet {
  sourceSetId: number;
  label: string;
  evalBeeImageUrl: string | null;
  questions: ExamVersionSnapshotQuestion[];
}

export interface ExamVersionSnapshot {
  schemaVersion: typeof EXAM_VERSION_SNAPSHOT_SCHEMA_VERSION;
  sourceExamId: number;
  title: string;
  institution: string;
  instructions: string;
  answerKeyWidthPt: number;
  allowQuestionSplit: boolean;
  questionLayouts: ExamQuestionLayouts;
  sets: ExamVersionSnapshotSet[];
}

export interface ExamVersion {
  id: number;
  examId: number;
  versionNumber: number;
  changeNote: string;
  snapshot: ExamVersionSnapshot;
  createdAt: string;
}

const QUESTION_TYPES: QuestionType[] = ["objetiva", "verdadeiro_falso", "numerica", "dissertativa"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseQuestionType(value: unknown): QuestionType | null {
  return typeof value === "string" && QUESTION_TYPES.includes(value as QuestionType)
    ? value as QuestionType
    : null;
}

function parseQuestionOption(value: unknown): QuestionOption | null {
  if (!isRecord(value) || !Number.isInteger(value.index) || typeof value.text !== "string") return null;
  return { index: value.index as number, text: value.text };
}

function parseSnapshotQuestion(value: unknown, sourceSetId: number): ExamVersionSnapshotQuestion | null {
  if (!isRecord(value)) return null;
  const questionType = parseQuestionType(value.questionType);
  const layout = normalizeQuestionLayout(value.layout, "column");
  const layoutOverride = value.layoutOverride === null
    ? null
    : value.layoutOverride === "column" || value.layoutOverride === "full"
      ? value.layoutOverride
      : null;
  const options = Array.isArray(value.options)
    ? value.options.map(parseQuestionOption)
    : [];
  if (
    !Number.isInteger(value.sourceQuestionId) ||
    !Number.isInteger(value.position) ||
    typeof value.statementHtml !== "string" ||
    (value.imageUrl !== null && typeof value.imageUrl !== "string") ||
    !questionType ||
    options.some((option) => option === null) ||
    !Array.isArray(value.shuffledOptions) ||
    !value.shuffledOptions.every((index) => Number.isInteger(index)) ||
    !Number.isInteger(value.correctShuffledIndex)
  ) return null;

  return {
    sourceQuestionId: value.sourceQuestionId as number,
    sourceSetId,
    position: value.position as number,
    statementHtml: sanitizeRichText(value.statementHtml),
    imageUrl: value.imageUrl as string | null,
    options: options as QuestionOption[],
    shuffledOptions: value.shuffledOptions as number[],
    correctShuffledIndex: value.correctShuffledIndex as number,
    questionType,
    answerLines: Number.isInteger(value.answerLines) ? Math.max(0, value.answerLines as number) : 0,
    layoutOverride,
    layout,
    difficulty: value.difficulty === "easy" || value.difficulty === "hard" ? value.difficulty : "medium",
    thematicArea: typeof value.thematicArea === "string" ? value.thematicArea : null,
    correctIndex: Number.isInteger(value.correctIndex) ? value.correctIndex as number : 0,
    correctAnswer: typeof value.correctAnswer === "string" ? value.correctAnswer : "",
    explanation: typeof value.explanation === "string" ? value.explanation : "",
  };
}

export function parseExamVersionSnapshot(value: unknown): ExamVersionSnapshot | null {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(raw) || raw.schemaVersion !== EXAM_VERSION_SNAPSHOT_SCHEMA_VERSION) return null;
  if (
    !Number.isInteger(raw.sourceExamId) ||
    typeof raw.title !== "string" ||
    typeof raw.institution !== "string" ||
    typeof raw.instructions !== "string" ||
    !Array.isArray(raw.sets)
  ) return null;

  const sets: ExamVersionSnapshotSet[] = [];
  for (const rawSet of raw.sets) {
    if (!isRecord(rawSet) || !Number.isInteger(rawSet.sourceSetId) || typeof rawSet.label !== "string" || !Array.isArray(rawSet.questions)) {
      return null;
    }
    const questions = rawSet.questions
      .map((question) => parseSnapshotQuestion(question, rawSet.sourceSetId as number));
    if (questions.some((question) => question === null)) return null;
    sets.push({
      sourceSetId: rawSet.sourceSetId as number,
      label: rawSet.label,
      evalBeeImageUrl: rawSet.evalBeeImageUrl === null || typeof rawSet.evalBeeImageUrl === "string" ? rawSet.evalBeeImageUrl as string | null : null,
      questions: questions as ExamVersionSnapshotQuestion[],
    });
  }

  return {
    schemaVersion: EXAM_VERSION_SNAPSHOT_SCHEMA_VERSION,
    sourceExamId: raw.sourceExamId as number,
    title: raw.title,
    institution: raw.institution,
    instructions: normalizeExamInstructions(raw.instructions),
    answerKeyWidthPt: Number.isFinite(raw.answerKeyWidthPt) ? raw.answerKeyWidthPt as number : 350,
    allowQuestionSplit: raw.allowQuestionSplit === true,
    questionLayouts: normalizeExamQuestionLayouts(raw.questionLayouts as Partial<Record<QuestionType, unknown>> | undefined),
    sets,
  };
}

export function buildExamVersionSnapshot(
  exam: Exam,
  loadQuestion: (questionId: number) => Question | undefined,
): ExamVersionSnapshot {
  return {
    schemaVersion: EXAM_VERSION_SNAPSHOT_SCHEMA_VERSION,
    sourceExamId: exam.id,
    title: exam.title,
    institution: exam.institution,
    instructions: normalizeExamInstructions(exam.instructions),
    answerKeyWidthPt: exam.answerKeyWidthPt,
    allowQuestionSplit: exam.allowQuestionSplit,
    questionLayouts: exam.questionLayouts,
    sets: [...exam.sets]
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }))
      .map((set) => ({
        sourceSetId: set.id,
        label: set.label,
        evalBeeImageUrl: set.evalBeeImageUrl,
        questions: [...set.questions]
          .sort((a, b) => a.position - b.position)
          .map((setQuestion) => {
            const question = loadQuestion(setQuestion.questionId);
            if (!question) throw new Error(`Questão ${setQuestion.questionId} não encontrada para a versão da prova.`);
            const layoutOverride = exam.questionLayoutOverrides[question.id] ?? null;
            return {
              sourceQuestionId: question.id,
              sourceSetId: set.id,
              position: setQuestion.position,
              statementHtml: sanitizeRichText(question.statement),
              imageUrl: question.imageUrl,
              options: question.options.map((option) => ({ ...option })),
              shuffledOptions: [...setQuestion.shuffledOptions],
              correctShuffledIndex: setQuestion.correctShuffledIndex,
              questionType: question.questionType,
              answerLines: question.answerLines,
              layoutOverride,
              layout: layoutOverride ?? exam.questionLayouts[question.questionType],
              difficulty: question.difficulty,
              thematicArea: question.thematicArea,
              correctIndex: question.correctIndex,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
            } satisfies ExamVersionSnapshotQuestion;
          }),
      })),
  };
}

export function cloneExamVersionSnapshot(snapshot: ExamVersionSnapshot): ExamVersionSnapshot {
  const parsed = parseExamVersionSnapshot(snapshot);
  if (!parsed) throw new Error("Snapshot de versão inválido.");
  return parsed;
}
