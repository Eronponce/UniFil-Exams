import type { QuestionType } from "@/types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface QuestionInfo {
  id: number;
  correctIndex: number;
  questionType: QuestionType;
}

export interface ShuffledSet {
  label: string;
  questionOrder: number[];
  shuffledOptions: number[][];
  correctShuffledIndices: number[];
}

export function buildSets(questions: QuestionInfo[], labels: string[]): ShuffledSet[] {
  const objetivas = questions.filter((q) => q.questionType === "objetiva");
  const vf = questions.filter((q) => q.questionType === "verdadeiro_falso");
  const dissertativas = questions.filter((q) => q.questionType === "dissertativa");

  return labels.map((label) => {
    const ordered = [...shuffle(objetivas), ...shuffle(vf), ...dissertativas];
    const questionOrder: number[] = [];
    const shuffledOptions: number[][] = [];
    const correctShuffledIndices: number[] = [];

    for (const q of ordered) {
      questionOrder.push(q.id);
      if (q.questionType === "objetiva") {
        const indices = shuffle([0, 1, 2, 3, 4]);
        shuffledOptions.push(indices);
        correctShuffledIndices.push(indices.indexOf(q.correctIndex));
      } else if (q.questionType === "verdadeiro_falso") {
        const indices = shuffle([0, 1]);
        shuffledOptions.push(indices);
        correctShuffledIndices.push(indices.indexOf(q.correctIndex));
      } else {
        // dissertativa: no shuffle, sentinel
        shuffledOptions.push([]);
        correctShuffledIndices.push(0);
      }
    }

    return { label, questionOrder, shuffledOptions, correctShuffledIndices };
  });
}
