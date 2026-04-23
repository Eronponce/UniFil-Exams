import { describe, it, expect } from "vitest";
import { parseResponse, buildPrompt } from "@/lib/ai/prompt";

describe("buildPrompt", () => {
  it("includes discipline and topic", () => {
    const prompt = buildPrompt("Algoritmos", "ordenação");
    expect(prompt).toContain("Algoritmos");
    expect(prompt).toContain("ordenação");
  });
});

describe("parseResponse", () => {
  it("parses valid JSON response", () => {
    const raw = JSON.stringify({
      statement: "Qual é a complexidade do Bubble Sort?",
      options: ["O(n)", "O(n²)", "O(log n)", "O(n log n)", "O(1)"],
      correctIndex: 1,
      explanation: "Bubble Sort é O(n²) no pior caso.",
    });
    const result = parseResponse(raw);
    expect(result.statement).toBe("Qual é a complexidade do Bubble Sort?");
    expect(result.options).toHaveLength(5);
    expect(result.correctIndex).toBe(1);
    expect(result.explanation).toBe("Bubble Sort é O(n²) no pior caso.");
  });

  it("extracts JSON embedded in extra text", () => {
    const raw = `Aqui está a questão:\n${JSON.stringify({
      statement: "Questão teste",
      options: ["A", "B", "C", "D", "E"],
      correctIndex: 0,
      explanation: "",
    })}\nFim.`;
    const result = parseResponse(raw);
    expect(result.statement).toBe("Questão teste");
  });

  it("throws on response without JSON", () => {
    expect(() => parseResponse("Não tenho uma resposta em JSON.")).toThrow();
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
