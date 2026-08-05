import { describe, expect, it } from "vitest";
import type { ExamSet, Question } from "@/types";
import { getExamQuestionIdsInSetAOrder, getQuestionOptionsInSetOrder } from "@/lib/exam/reference-set";

function makeSet(label: string, ids: number[]): ExamSet {
  return {
    id: label.charCodeAt(0),
    examId: 1,
    label,
    evalBeeImageUrl: null,
    createdAt: "2026-08-04",
    questions: ids.map((questionId, position) => ({
      questionId,
      position,
      shuffledOptions: [],
      correctShuffledIndex: 0,
    })),
  };
}

describe("getExamQuestionIdsInSetAOrder", () => {
  it("uses Set A as the canonical export order regardless of database order", () => {
    const sets = [makeSet("C", [3, 1, 2]), makeSet("B", [2, 3, 1]), makeSet("A", [1, 2, 3])];

    expect(getExamQuestionIdsInSetAOrder(sets)).toEqual([1, 2, 3]);
  });

  it("respects positions and appends a question that exists only outside Set A", () => {
    const setA = makeSet("A", [10, 20]);
    setA.questions.reverse();
    const setB = makeSet("B", [20, 30, 10]);

    expect(getExamQuestionIdsInSetAOrder([setB, setA])).toEqual([10, 20, 30]);
  });

  it("falls back to the first label when an old exam has no Set A", () => {
    expect(getExamQuestionIdsInSetAOrder([makeSet("C", [2, 1]), makeSet("B", [1, 2])])).toEqual([1, 2]);
  });
});

describe("getQuestionOptionsInSetOrder", () => {
  const question: Question = {
    id: 10,
    disciplineId: 1,
    statement: "Questão",
    imageUrl: null,
    options: ["Correta", "B", "C", "D", "E"].map((text, index) => ({ index, text })),
    correctIndex: 0,
    difficulty: "medium",
    source: "manual",
    audited: true,
    rejected: false,
    thematicArea: null,
    explanation: "",
    questionType: "objetiva",
    answerLines: 0,
    correctAnswer: "",
    createdAt: "2026-08-04",
  };

  it("uses the Set A option shuffle and assigns the displayed answer letter", () => {
    const setQuestion = {
      questionId: 10,
      position: 0,
      shuffledOptions: [1, 2, 3, 0, 4],
      correctShuffledIndex: 3,
    };

    expect(getQuestionOptionsInSetOrder(question, setQuestion)).toEqual([
      { originalIndex: 1, letter: "A", text: "B", isCorrect: false },
      { originalIndex: 2, letter: "B", text: "C", isCorrect: false },
      { originalIndex: 3, letter: "C", text: "D", isCorrect: false },
      { originalIndex: 0, letter: "D", text: "Correta", isCorrect: true },
      { originalIndex: 4, letter: "E", text: "E", isCorrect: false },
    ]);
  });

  it("falls back to original options when the stored shuffle is invalid", () => {
    const displays = getQuestionOptionsInSetOrder(question, {
      questionId: 10,
      position: 0,
      shuffledOptions: [0, 0],
      correctShuffledIndex: 0,
    });

    expect(displays.map(({ letter, text, isCorrect }) => ({ letter, text, isCorrect }))).toEqual([
      { letter: "A", text: "Correta", isCorrect: true },
      { letter: "B", text: "B", isCorrect: false },
      { letter: "C", text: "C", isCorrect: false },
      { letter: "D", text: "D", isCorrect: false },
      { letter: "E", text: "E", isCorrect: false },
    ]);
  });
});
