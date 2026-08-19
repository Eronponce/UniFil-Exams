import type { QuestionLayout, QuestionType } from "@/types";

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface QuestionInfo {
  id: number;
  correctIndex: number;
  questionType: QuestionType;
  layout?: QuestionLayout;
}

export interface ShuffledSet {
  label: string;
  questionOrder: number[];
  shuffledOptions: number[][];
  correctShuffledIndices: number[];
}

export interface BuildSetsOptions {
  /** Keeps the academic type order and groups half-width questions before full-width questions. */
  compactLayoutOrder?: boolean;
  random?: () => number;
}

function orderTypeGroup(
  questions: QuestionInfo[],
  compactLayoutOrder: boolean,
  random: () => number,
): QuestionInfo[] {
  if (!compactLayoutOrder) return shuffle(questions, random);
  const columns = questions.filter((question) => question.layout !== "full");
  const fullWidth = questions.filter((question) => question.layout === "full");
  return [...shuffle(columns, random), ...shuffle(fullWidth, random)];
}

export function buildSets(
  questions: QuestionInfo[],
  labels: string[],
  options: BuildSetsOptions = {},
): ShuffledSet[] {
  const objetivas = questions.filter((q) => q.questionType === "objetiva");
  const vf = questions.filter((q) => q.questionType === "verdadeiro_falso");
  const numericas = questions.filter((q) => q.questionType === "numerica");
  const dissertativas = questions.filter((q) => q.questionType === "dissertativa");
  const random = options.random ?? Math.random;
  const compact = options.compactLayoutOrder === true;

  return labels.map((label) => {
    const ordered = [
      ...orderTypeGroup(objetivas, compact, random),
      ...orderTypeGroup(vf, compact, random),
      ...orderTypeGroup(numericas, compact, random),
      ...(compact ? orderTypeGroup(dissertativas, true, random) : dissertativas),
    ];
    const questionOrder: number[] = [];
    const shuffledOptions: number[][] = [];
    const correctShuffledIndices: number[] = [];

    for (const q of ordered) {
      questionOrder.push(q.id);
      if (q.questionType === "objetiva") {
        const indices = shuffle([0, 1, 2, 3, 4], random);
        shuffledOptions.push(indices);
        correctShuffledIndices.push(indices.indexOf(q.correctIndex));
      } else if (q.questionType === "verdadeiro_falso") {
        const indices = shuffle([0, 1], random);
        shuffledOptions.push(indices);
        correctShuffledIndices.push(indices.indexOf(q.correctIndex));
      } else {
        // numerica / dissertativa: no shuffle, sentinel
        shuffledOptions.push([]);
        correctShuffledIndices.push(0);
      }
    }

    return { label, questionOrder, shuffledOptions, correctShuffledIndices };
  });
}
