import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Exam, ExamSet, Question } from "@/types";
import { buildAnswerKeyCsv, buildExamTraceCsv } from "@/lib/pdf/exam-csv";

const mockGetQuestion = vi.fn<(id: number) => Question | undefined>();

vi.mock("@/lib/db/questions", () => ({
  getQuestion: (id: number) => mockGetQuestion(id),
}));

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 10,
    disciplineId: 1,
    statement: "Questão 10?",
    imageUrl: null,
    options: [
      { index: 0, text: "A" },
      { index: 1, text: "B" },
      { index: 2, text: "C" },
      { index: 3, text: "D" },
      { index: 4, text: "E" },
    ],
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
    createdAt: "2026-04-22",
    ...overrides,
  };
}

function makeExam(sets: ExamSet[], overrides: Partial<Exam> = {}): Exam {
  return {
    id: 7,
    title: "Prova de rastreabilidade",
    disciplineId: 1,
    institution: "UniFil",
    answerKeyWidthPt: 350,
    allowQuestionSplit: false,
    questionLayouts: {
      objetiva: "column",
      verdadeiro_falso: "column",
      numerica: "column",
      dissertativa: "full",
    },
    sets,
    createdAt: "2026-04-22",
    ...overrides,
  };
}

beforeEach(() => { mockGetQuestion.mockReset(); });

describe("buildAnswerKeyCsv — objetivas", () => {
  it("generates CSV with correct answer letters", async () => {
    mockGetQuestion.mockImplementation((id) => makeQuestion({ id, statement: `Questão ${id}?` }));

    const set: ExamSet = {
      id: 1, examId: 1, label: "A", evalBeeImageUrl: null, createdAt: "2026-04-22",
      questions: [
        { questionId: 10, position: 0, shuffledOptions: [1, 0, 2, 3, 4], correctShuffledIndex: 1 },
        { questionId: 11, position: 1, shuffledOptions: [2, 1, 0, 3, 4], correctShuffledIndex: 0 },
      ],
    };

    const csv = buildAnswerKeyCsv("Prova 1", set);
    expect(csv).toContain("Set A");
    expect(csv).toContain("1,B");
    expect(csv).toContain("2,A");
  });
});

describe("buildAnswerKeyCsv — V/F and dissertativa", () => {
  it("V/F question outputs V when shuffledOptions[correctShuffledIndex]=0", async () => {
    mockGetQuestion.mockReturnValue(makeQuestion({ questionType: "verdadeiro_falso", options: [{ index: 0, text: "Verdadeiro" }, { index: 1, text: "Falso" }], correctIndex: 0 }));

    const set: ExamSet = {
      id: 2, examId: 1, label: "B", evalBeeImageUrl: null, createdAt: "2026-04-22",
      questions: [
        { questionId: 99, position: 0, shuffledOptions: [0, 1], correctShuffledIndex: 0 },
        { questionId: 99, position: 1, shuffledOptions: [1, 0], correctShuffledIndex: 0 },
      ],
    };

    const csv = buildAnswerKeyCsv("Prova VF", set);
    expect(csv).toContain("1,V");
    expect(csv).toContain("2,F");
  });

  it("dissertativa outputs '-'", async () => {
    mockGetQuestion.mockReturnValue(makeQuestion({ questionType: "dissertativa", options: [], answerLines: 5 }));

    const set: ExamSet = {
      id: 3, examId: 1, label: "C", evalBeeImageUrl: null, createdAt: "2026-04-22",
      questions: [{ questionId: 100, position: 0, shuffledOptions: [], correctShuffledIndex: 0 }],
    };

    const csv = buildAnswerKeyCsv("Prova Diss", set);
    expect(csv).toContain("1,-");
  });
});

describe("buildExamTraceCsv", () => {
  it("orders sets and positions, preserves question IDs, and resolves shuffled answers", async () => {
    const questions: Record<number, Question> = {
      11: makeQuestion({ id: 11, statement: "Objetiva compartilhada", correctIndex: 0 }),
      12: makeQuestion({
        id: 12,
        questionType: "verdadeiro_falso",
        options: [{ index: 0, text: "Verdadeiro" }, { index: 1, text: "Falso" }],
        correctIndex: 0,
        statement: "Afirmação VF",
      }),
      13: makeQuestion({ id: 13, questionType: "numerica", options: [], correctAnswer: "42", statement: "Calcule" }),
    };
    mockGetQuestion.mockImplementation((id) => questions[id]);

    const exam = makeExam([
      {
        id: 20, examId: 7, label: "B", evalBeeImageUrl: null, createdAt: "2026-04-22",
        questions: [
          { questionId: 11, position: 1, shuffledOptions: [0, 1, 2, 3, 4], correctShuffledIndex: 0 },
          { questionId: 13, position: 0, shuffledOptions: [], correctShuffledIndex: 0 },
        ],
      },
      {
        id: 10, examId: 7, label: "A", evalBeeImageUrl: null, createdAt: "2026-04-22",
        questions: [
          { questionId: 11, position: 1, shuffledOptions: [1, 0, 2, 3, 4], correctShuffledIndex: 1 },
          { questionId: 12, position: 0, shuffledOptions: [1, 0], correctShuffledIndex: 1 },
        ],
      },
    ]);

    const rows = buildExamTraceCsv(exam).split("\r\n");
    expect(rows[1]).toContain('"7:A:1"');
    expect(rows[1]).toContain('"10","A","1","12","verdadeiro_falso"');
    expect(rows[1]).toContain('"V"');
    expect(rows[2]).toContain('"7:A:2"');
    expect(rows[2]).toContain('"11","objetiva"');
    expect(rows[2]).toContain('"B"');
    expect(rows[3]).toContain('"7:B:1"');
    expect(rows[3]).toContain('"20","B","1","13","numerica"');
    expect(rows[3]).toContain('"42"');
    expect(rows[4]).toContain('"7:B:2"');
    expect(rows[4]).toContain('"11","objetiva"');
    expect(rows[4]).toContain('"A"');
  });

  it("escapes commas, quotes and line breaks and keeps an absent question traceable", async () => {
    mockGetQuestion.mockImplementation((id) => id === 30
      ? makeQuestion({
        id,
        statement: 'Enunciado com, vírgula e "aspas"',
        thematicArea: "Área\ncom quebra",
      })
      : undefined);

    const csv = buildExamTraceCsv(makeExam([
      {
        id: 10, examId: 7, label: "A", evalBeeImageUrl: null, createdAt: "2026-04-22",
        questions: [
          { questionId: 30, position: 0, shuffledOptions: [0, 1, 2, 3, 4], correctShuffledIndex: 0 },
          { questionId: 404, position: 1, shuffledOptions: [], correctShuffledIndex: 0 },
        ],
      },
    ], { title: 'Prova, "Final"\n2026' }));

    expect(csv).toContain('"Prova, ""Final""\n2026"');
    expect(csv).toContain('"Área\ncom quebra"');
    expect(csv).toContain('"Enunciado com, vírgula e ""aspas"""');
    expect(csv).toContain('"[Questão ausente no banco: ID 404]"');
    expect(csv).toContain('"ausente"');
    expect(csv).toContain("\r\n");
  });
});
