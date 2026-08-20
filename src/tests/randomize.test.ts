import { describe, it, expect } from "vitest";
import { buildSets, type QuestionInfo } from "@/lib/exam/randomize";

const OBJETIVAS: QuestionInfo[] = [
  { id: 1, correctIndex: 1, questionType: "objetiva" },
  { id: 2, correctIndex: 2, questionType: "objetiva" },
  { id: 3, correctIndex: 0, questionType: "objetiva" },
  { id: 4, correctIndex: 3, questionType: "objetiva" },
  { id: 5, correctIndex: 4, questionType: "objetiva" },
];

describe("buildSets", () => {
  it("creates the requested number of sets", () => {
    const sets = buildSets(OBJETIVAS, ["A", "B", "C"]);
    expect(sets).toHaveLength(3);
  });

  it("each set contains all question IDs exactly once", () => {
    const sets = buildSets(OBJETIVAS, ["A", "B"]);
    for (const s of sets) {
      expect([...s.questionOrder].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("objetiva shuffledOptions contains each index 0-4 exactly once", () => {
    const sets = buildSets(OBJETIVAS, ["A"]);
    const s = sets[0];
    for (const opts of s.shuffledOptions) {
      expect([...opts].sort()).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it("correctShuffledIndex points to the original correct option", () => {
    const sets = buildSets(OBJETIVAS, ["A", "B", "C"]);
    for (const s of sets) {
      s.questionOrder.forEach((qid, pos) => {
        const q = OBJETIVAS.find((q) => q.id === qid)!;
        const shuffledOpts = s.shuffledOptions[pos];
        const correctPos = s.correctShuffledIndices[pos];
        expect(shuffledOpts[correctPos]).toBe(q.correctIndex);
      });
    }
  });

  it("two sets have different question orders (probabilistic)", () => {
    const results: boolean[] = [];
    for (let i = 0; i < 20; i++) {
      const sets = buildSets(OBJETIVAS, ["A", "B"]);
      results.push(JSON.stringify(sets[0].questionOrder) !== JSON.stringify(sets[1].questionOrder));
    }
    expect(results.some(Boolean)).toBe(true);
  });

  it("V/F questions have shuffledOptions with exactly 2 elements", () => {
    const vfQs: QuestionInfo[] = [
      { id: 10, correctIndex: 0, questionType: "verdadeiro_falso" },
      { id: 11, correctIndex: 1, questionType: "verdadeiro_falso" },
    ];
    const sets = buildSets(vfQs, ["A"]);
    const s = sets[0];
    for (const opts of s.shuffledOptions) {
      expect(opts).toHaveLength(2);
      expect([...opts].sort()).toEqual([0, 1]);
    }
  });

  it("V/F correctShuffledIndex points to the original correct option", () => {
    const vfQs: QuestionInfo[] = [
      { id: 10, correctIndex: 0, questionType: "verdadeiro_falso" },
      { id: 11, correctIndex: 1, questionType: "verdadeiro_falso" },
    ];
    const sets = buildSets(vfQs, ["A"]);
    const s = sets[0];
    s.questionOrder.forEach((qid, pos) => {
      const q = vfQs.find((q) => q.id === qid)!;
      const shuffledOpts = s.shuffledOptions[pos];
      const correctPos = s.correctShuffledIndices[pos];
      expect(shuffledOpts[correctPos]).toBe(q.correctIndex);
    });
  });

  it("dissertativas have empty shuffledOptions and correctShuffledIndex 0", () => {
    const diss: QuestionInfo[] = [
      { id: 20, correctIndex: 0, questionType: "dissertativa" },
      { id: 21, correctIndex: 0, questionType: "dissertativa" },
    ];
    const sets = buildSets(diss, ["A"]);
    const s = sets[0];
    for (const opts of s.shuffledOptions) {
      expect(opts).toHaveLength(0);
    }
    for (const ci of s.correctShuffledIndices) {
      expect(ci).toBe(0);
    }
  });

  it("section order: objetivas first, vf second, dissertativas last", () => {
    const mixed: QuestionInfo[] = [
      { id: 30, correctIndex: 0, questionType: "dissertativa" },
      { id: 31, correctIndex: 1, questionType: "verdadeiro_falso" },
      { id: 32, correctIndex: 2, questionType: "objetiva" },
    ];
    const sets = buildSets(mixed, ["A"]);
    const s = sets[0];
    // position 0 must be objetiva, 1 must be vf, 2 must be dissertativa
    const types = s.questionOrder.map((id) => mixed.find((q) => q.id === id)!.questionType);
    expect(types[0]).toBe("objetiva");
    expect(types[1]).toBe("verdadeiro_falso");
    expect(types[2]).toBe("dissertativa");
  });

  it("compact order keeps type sequence and groups column before full within every type", () => {
    const mixed: QuestionInfo[] = [
      { id: 1, correctIndex: 0, questionType: "objetiva", layout: "column" },
      { id: 2, correctIndex: 0, questionType: "objetiva", layout: "full" },
      { id: 3, correctIndex: 0, questionType: "verdadeiro_falso", layout: "full" },
      { id: 4, correctIndex: 0, questionType: "verdadeiro_falso", layout: "column" },
      { id: 5, correctIndex: 0, questionType: "numerica", layout: "full" },
      { id: 6, correctIndex: 0, questionType: "numerica", layout: "column" },
      { id: 7, correctIndex: 0, questionType: "dissertativa", layout: "full" },
      { id: 8, correctIndex: 0, questionType: "dissertativa", layout: "column" },
    ];

    const [set] = buildSets(mixed, ["A"], { compactLayoutOrder: true, random: () => 0 });

    expect(set.questionOrder).toEqual([1, 2, 4, 3, 6, 5, 8, 7]);
  });

  it("regular order remains random across widths", () => {
    const questions: QuestionInfo[] = [
      { id: 1, correctIndex: 0, questionType: "objetiva", layout: "column" },
      { id: 2, correctIndex: 0, questionType: "objetiva", layout: "full" },
      { id: 3, correctIndex: 0, questionType: "objetiva", layout: "column" },
    ];

    const [set] = buildSets(questions, ["A"], { random: () => 0 });

    expect(set.questionOrder).toEqual([2, 3, 1]);
  });

  it("keeps the legacy discursive order when compact mode is off", () => {
    const questions: QuestionInfo[] = [
      { id: 1, correctIndex: 0, questionType: "dissertativa", layout: "column" },
      { id: 2, correctIndex: 0, questionType: "dissertativa", layout: "full" },
      { id: 3, correctIndex: 0, questionType: "dissertativa", layout: "column" },
    ];

    const [set] = buildSets(questions, ["A"], { random: () => 0 });

    expect(set.questionOrder).toEqual([1, 2, 3]);
  });

  it("uses one canonical manual order for every set while shuffling only objective/VF options", () => {
    const questions: QuestionInfo[] = [
      { id: 1, correctIndex: 0, questionType: "objetiva", layout: "full" },
      { id: 2, correctIndex: 1, questionType: "objetiva", layout: "column" },
      { id: 3, correctIndex: 0, questionType: "verdadeiro_falso", layout: "column" },
      { id: 4, correctIndex: 0, questionType: "numerica", layout: "full" },
      { id: 5, correctIndex: 0, questionType: "dissertativa", layout: "full" },
    ];

    const options = { manualQuestionOrder: [1, 2, 3, 4, 5], seed: "draft-42" };
    const first = buildSets(questions, ["A", "B"], options);
    const second = buildSets(questions, ["A", "B"], options);

    expect(first).toEqual(second);
    expect(first.map((set) => set.questionOrder)).toEqual([[2, 1, 3, 4, 5], [2, 1, 3, 4, 5]]);
    expect(first[0]?.shuffledOptions[3]).toEqual([]);
    expect(first[0]?.shuffledOptions[4]).toEqual([]);
    expect(first[0]?.shuffledOptions[0]).toHaveLength(5);
    expect(first[0]?.shuffledOptions[1]).toHaveLength(5);
    expect(first[0]?.shuffledOptions[2]).toHaveLength(2);

    for (const set of first) {
      set.questionOrder.forEach((questionId, position) => {
        const question = questions.find(({ id }) => id === questionId)!;
        const shuffled = set.shuffledOptions[position]!;
        if (question.questionType === "objetiva" || question.questionType === "verdadeiro_falso") {
          expect(shuffled[set.correctShuffledIndices[position]!]).toBe(question.correctIndex);
        } else {
          expect(shuffled).toEqual([]);
        }
      });
    }
  });

  it("matches the deterministic preview PRNG for the same seed", () => {
    const questions: QuestionInfo[] = [
      { id: 10, correctIndex: 0, questionType: "objetiva" },
      { id: 11, correctIndex: 1, questionType: "verdadeiro_falso" },
    ];
    const first = buildSets(questions, ["A", "B"], { manualQuestionOrder: [10, 11], seed: "same" });
    const second = buildSets(questions, ["A", "B"], { manualQuestionOrder: [10, 11], seed: "same" });
    const different = buildSets(questions, ["A", "B"], { manualQuestionOrder: [10, 11], seed: "different" });

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(different));
  });
});
