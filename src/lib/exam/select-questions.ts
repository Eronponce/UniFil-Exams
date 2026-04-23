import type { QuestionType } from "@/types";
import type { QuestionInfo } from "./randomize";

export interface ExamSelectionRequest {
  totalRequested: number;
  requestedByType: Record<QuestionType, number>;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function normalizeExamSelectionRequest(formData: FormData): ExamSelectionRequest {
  const totalRequested = Math.max(Number(formData.get("numQuestions")) || 0, 0);
  return {
    totalRequested,
    requestedByType: {
      objetiva: Math.max(Number(formData.get("numObjetivas")) || 0, 0),
      verdadeiro_falso: Math.max(Number(formData.get("numVF")) || 0, 0),
      dissertativa: Math.max(Number(formData.get("numDissertativas")) || 0, 0),
    },
  };
}

export function pickQuestionsForExam(questions: QuestionInfo[], request: ExamSelectionRequest): QuestionInfo[] {
  const hasTypeSpecificSelection = Object.values(request.requestedByType).some((value) => value > 0);
  if (!hasTypeSpecificSelection) {
    if (request.totalRequested > 0 && request.totalRequested < questions.length) {
      return shuffle(questions).slice(0, request.totalRequested);
    }
    return questions;
  }

  const grouped = {
    objetiva: questions.filter((q) => q.questionType === "objetiva"),
    verdadeiro_falso: questions.filter((q) => q.questionType === "verdadeiro_falso"),
    dissertativa: questions.filter((q) => q.questionType === "dissertativa"),
  } satisfies Record<QuestionType, QuestionInfo[]>;

  for (const [type, requested] of Object.entries(request.requestedByType) as [QuestionType, number][]) {
    if (requested > grouped[type].length) {
      throw new Error(
        `Solicitadas ${requested} questão(ões) do tipo ${type}, mas só existem ${grouped[type].length} selecionada(s).`,
      );
    }
  }

  return [
    ...shuffle(grouped.objetiva).slice(0, request.requestedByType.objetiva),
    ...shuffle(grouped.verdadeiro_falso).slice(0, request.requestedByType.verdadeiro_falso),
    ...shuffle(grouped.dissertativa).slice(0, request.requestedByType.dissertativa),
  ];
}
