import { describe, expect, it } from "vitest";
import { buildPrompt, parseResponse } from "@/lib/ai/prompt";
import { buildImportPrompt } from "@/lib/ai/prompt-templates";

describe("buildPrompt", () => {
  it("includes discipline, topic and HTML guidance", () => {
    const prompt = buildPrompt("Algoritmos", "ordenacao");
    expect(prompt).toContain("Algoritmos");
    expect(prompt).toContain("ordenacao");
    expect(prompt).toContain("HTML sanitizado");
    expect(prompt).toContain("questionType");
  });
});

describe("buildImportPrompt", () => {
  it("documents all supported question types and HTML rules", () => {
    const prompt = buildImportPrompt();
    expect(prompt).toContain('"objetiva"');
    expect(prompt).toContain('"verdadeiro_falso"');
    expect(prompt).toContain('"dissertativa"');
    expect(prompt).toContain("HTML sanitizado");
  });
});

describe("parseResponse", () => {
  it("parses valid JSON response", () => {
    const raw = JSON.stringify({
      statement: "Qual e a complexidade do Bubble Sort?",
      questionType: "objetiva",
      options: ["O(n)", "O(n^2)", "O(log n)", "O(n log n)", "O(1)"],
      correctIndex: 1,
      difficulty: "hard",
      explanation: "Bubble Sort e O(n^2) no pior caso.",
      thematicArea: "Ordenacao",
      answerLines: 0,
    });
    const result = parseResponse(raw);
    expect(result.statement).toBe("Qual e a complexidade do Bubble Sort?");
    expect(result.options).toHaveLength(5);
    expect(result.correctIndex).toBe(1);
    expect(result.explanation).toBe("Bubble Sort e O(n^2) no pior caso.");
    expect(result.difficulty).toBe("hard");
    expect(result.thematicArea).toBe("Ordenacao");
  });

  it("extracts JSON embedded in extra text", () => {
    const raw = `Aqui esta a questao:\n${JSON.stringify({
      statement: "Questao teste",
      options: ["A", "B", "C", "D", "E"],
      correctIndex: 0,
      explanation: "",
    })}\nFim.`;
    const result = parseResponse(raw);
    expect(result.statement).toBe("Questao teste");
  });

  it("throws on response without JSON", () => {
    expect(() => parseResponse("Nao tenho uma resposta em JSON.")).toThrow();
  });

  it("throws on JSON with wrong number of options", () => {
    const raw = JSON.stringify({
      statement: "Q",
      options: ["A", "B", "C"],
      correctIndex: 0,
      explanation: "",
    });
    expect(() => parseResponse(raw)).toThrow();
  });
});
