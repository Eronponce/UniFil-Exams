import type { QuestionType } from "@/types";
import type { QuestionInfo } from "./randomize";

export interface ExamSelectionRequest {
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
  return {
    requestedByType: {
      objetiva: Math.max(Number(formData.get("numObjetivas")) || 0, 0),
      verdadeiro_falso: Math.max(Number(formData.get("numVF")) || 0, 0),
      dissertativa: Math.max(Number(formData.get("numDissertativas")) || 0, 0),
    },
  };
}

export function pickQuestionsForExam(questions: QuestionInfo[], request: ExamSelectionRequest): QuestionInfo[] {
  const totalRequested = Object.values(request.requestedByType).reduce((sum, v) => sum + v, 0);

  if (totalRequested === 0) {
    throw new Error("Preencha a quantidade de questões para pelo menos um tipo (Objetivas, V/F ou Dissertativas).");
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

  // Order: objetivas → verdadeiro_falso → dissertativas
  return [
    ...shuffle(grouped.objetiva).slice(0, request.requestedByType.objetiva),
    ...shuffle(grouped.verdadeiro_falso).slice(0, request.requestedByType.verdadeiro_falso),
    ...shuffle(grouped.dissertativa).slice(0, request.requestedByType.dissertativa),
  ];
}
