function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface ShuffledSet {
  label: string;
  questionOrder: number[];
  shuffledOptions: number[][];
  correctShuffledIndices: number[];
}

export function buildSets(
  questionIds: number[],
  correctIndices: Record<number, number>,
  labels: string[]
): ShuffledSet[] {
  return labels.map((label) => {
    const questionOrder = shuffle(questionIds);
    const shuffledOptions: number[][] = [];
    const correctShuffledIndices: number[] = [];

    for (const qid of questionOrder) {
      const originalCorrect = correctIndices[qid] ?? 0;
      const indices = shuffle([0, 1, 2, 3, 4]);
      shuffledOptions.push(indices);
      const pos = indices.indexOf(originalCorrect);
      correctShuffledIndices.push(pos);
    }

    return { label, questionOrder, shuffledOptions, correctShuffledIndices };
  });
}
