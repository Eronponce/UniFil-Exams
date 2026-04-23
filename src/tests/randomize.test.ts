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
});
