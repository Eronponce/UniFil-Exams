import { describe, it, expect } from "vitest";
import { buildSets } from "@/lib/exam/randomize";

const QUESTION_IDS = [1, 2, 3, 4, 5];
const CORRECT_INDICES: Record<number, number> = { 1: 1, 2: 2, 3: 0, 4: 3, 5: 4 };

describe("buildSets", () => {
  it("creates the requested number of sets", () => {
    const sets = buildSets(QUESTION_IDS, CORRECT_INDICES, ["A", "B", "C"]);
    expect(sets).toHaveLength(3);
  });

  it("each set contains all question IDs exactly once", () => {
    const sets = buildSets(QUESTION_IDS, CORRECT_INDICES, ["A", "B"]);
    for (const s of sets) {
      expect(s.questionOrder.sort()).toEqual([...QUESTION_IDS].sort());
    }
  });

  it("shuffledOptions contains each index 0-4 exactly once", () => {
    const sets = buildSets(QUESTION_IDS, CORRECT_INDICES, ["A"]);
    const s = sets[0];
    for (const opts of s.shuffledOptions) {
      expect(opts.sort()).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it("correctShuffledIndex points to the original correct option", () => {
    const sets = buildSets(QUESTION_IDS, CORRECT_INDICES, ["A", "B", "C"]);
    for (const s of sets) {
      s.questionOrder.forEach((qid, pos) => {
        const originalCorrect = CORRECT_INDICES[qid];
        const shuffledOpts = s.shuffledOptions[pos];
        const correctPos = s.correctShuffledIndices[pos];
        expect(shuffledOpts[correctPos]).toBe(originalCorrect);
      });
    }
  });

  it("two sets have different question orders (probabilistic)", () => {
    const results: boolean[] = [];
    for (let i = 0; i < 20; i++) {
      const sets = buildSets(QUESTION_IDS, CORRECT_INDICES, ["A", "B"]);
      results.push(JSON.stringify(sets[0].questionOrder) !== JSON.stringify(sets[1].questionOrder));
    }
    expect(results.some(Boolean)).toBe(true);
  });
});
