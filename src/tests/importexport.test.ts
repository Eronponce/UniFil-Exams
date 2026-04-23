import { describe, it, expect } from "vitest";
import { QuestionExportFileSchema, ExportedQuestionSchema, parseCsvQuestions } from "@/lib/importexport/types";
import { questionsToJson, questionsToCsv } from "@/lib/importexport/export";
import type { Question } from "@/types";

const SAMPLE_QUESTION: Question = {
  id: 1,
  disciplineId: 2,
  statement: "Qual é a capital do Brasil?",
  imageUrl: null,
  options: [
    { index: 0, text: "São Paulo" },
    { index: 1, text: "Rio de Janeiro" },
    { index: 2, text: "Brasília" },
    { index: 3, text: "Salvador" },
    { index: 4, text: "Manaus" },
  ],
  correctIndex: 2,
  difficulty: "easy",
  source: "manual",
  audited: true,
  thematicArea: "Geografia",
  explanation: "Brasília é a capital federal.",
  questionType: "objetiva",
  answerLines: 0,
  createdAt: "2026-04-22",
};

const VF_QUESTION: Question = {
  ...SAMPLE_QUESTION,
  id: 2,
  statement: "A terra é plana.",
  options: [{ index: 0, text: "Verdadeiro" }, { index: 1, text: "Falso" }],
  correctIndex: 1,
  questionType: "verdadeiro_falso",
};

const DISS_QUESTION: Question = {
  ...SAMPLE_QUESTION,
  id: 3,
  statement: "Explique o processo de fotossíntese.",
  options: [],
  correctIndex: 0,
  questionType: "dissertativa",
  answerLines: 5,
};

describe("questionsToJson", () => {
  it("produces valid JSON that round-trips through QuestionExportFileSchema", () => {
    const json = questionsToJson([SAMPLE_QUESTION, VF_QUESTION, DISS_QUESTION]);
    const parsed = QuestionExportFileSchema.parse(JSON.parse(json));
    expect(parsed.version).toBe(1);
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.questions[0].statement).toBe("Qual é a capital do Brasil?");
    expect(parsed.questions[1].questionType).toBe("verdadeiro_falso");
    expect(parsed.questions[2].questionType).toBe("dissertativa");
    expect(parsed.questions[2].answerLines).toBe(5);
  });

  it("excludes id, disciplineId, audited, source, imageUrl, createdAt", () => {
    const json = questionsToJson([SAMPLE_QUESTION]);
    const obj = JSON.parse(json) as { questions: Record<string, unknown>[] };
    const q = obj.questions[0];
    expect(q).not.toHaveProperty("id");
    expect(q).not.toHaveProperty("disciplineId");
    expect(q).not.toHaveProperty("audited");
    expect(q).not.toHaveProperty("source");
    expect(q).not.toHaveProperty("createdAt");
  });
});

describe("questionsToCsv", () => {
  it("produces correct header", () => {
    const csv = questionsToCsv([SAMPLE_QUESTION]);
    expect(csv.startsWith("statement,question_type,difficulty")).toBe(true);
  });

  it("produces correct row count (header + N questions)", () => {
    const csv = questionsToCsv([SAMPLE_QUESTION, VF_QUESTION]);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it("handles statement with comma by quoting the field", () => {
    const q: Question = { ...SAMPLE_QUESTION, statement: "Sim, ou não?" };
    const csv = questionsToCsv([q]);
    expect(csv).toContain('"Sim, ou não?"');
  });

  it("dissertativa has empty option columns", () => {
    const csv = questionsToCsv([DISS_QUESTION]);
    const row = csv.split("\n")[1];
    expect(row).toContain(",dissertativa,");
  });
});

describe("parseCsvQuestions", () => {
  it("parses a valid CSV back to ExportedQuestion array", () => {
    const csv = questionsToCsv([SAMPLE_QUESTION]);
    const parsed = parseCsvQuestions(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].statement).toBe("Qual é a capital do Brasil?");
    expect(parsed[0].questionType).toBe("objetiva");
    expect(parsed[0].correctIndex).toBe(2);
  });

  it("handles quoted fields containing commas", () => {
    const csv = `statement,question_type,difficulty,option_a,option_b,option_c,option_d,option_e,correct_index,thematic_area,answer_lines\n"Sim, ou não?",objetiva,easy,A,B,C,D,E,0,,0`;
    const parsed = parseCsvQuestions(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].statement).toBe("Sim, ou não?");
  });

  it("returns empty array for empty CSV (header only)", () => {
    const csv = `statement,question_type,difficulty,option_a,option_b,option_c,option_d,option_e,correct_index,thematic_area,answer_lines`;
    const parsed = parseCsvQuestions(csv);
    expect(parsed).toHaveLength(0);
  });

  it("defaults questionType to objetiva when missing", () => {
    const csv = `statement,question_type,difficulty,option_a,option_b,option_c,option_d,option_e,correct_index,thematic_area,answer_lines\nQuestão?,,,A,B,C,D,E,0,,0`;
    const parsed = parseCsvQuestions(csv);
    expect(parsed[0].questionType).toBe("objetiva");
  });
});

describe("ExportedQuestionSchema", () => {
  it("rejects empty statement", () => {
    const result = ExportedQuestionSchema.safeParse({ statement: "" });
    expect(result.success).toBe(false);
  });

  it("accepts partial data with defaults", () => {
    const result = ExportedQuestionSchema.safeParse({ statement: "Questão?" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.questionType).toBe("objetiva");
      expect(result.data.difficulty).toBe("medium");
      expect(result.data.answerLines).toBe(0);
    }
  });
});
