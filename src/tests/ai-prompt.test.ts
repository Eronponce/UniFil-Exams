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
  it("anchors every rule to the professor-provided topic", () => {
    const prompt = buildImportPrompt("Engenharia de Software — requisitos");
    expect(prompt).toContain("ASSUNTO/TEMA DA PROVA (preenchido pelo professor): Engenharia de Software — requisitos");
    expect(prompt).toContain('Quando este prompt mencionar "tema", "assunto" ou "conteúdo"');
    expect(prompt).toContain("Todas as questões, enunciados, evidências, alternativas, explicações e áreas temáticas");
    expect(prompt).toContain("Não troque o assunto por um tema genérico");
  });

  it("shows an explicit placeholder when no topic is supplied", () => {
    expect(buildImportPrompt()).toContain("[PREENCHA AQUI O ASSUNTO/TEMA DA PROVA]");
  });

  it("includes the requested quantity for every question type", () => {
    const prompt = buildImportPrompt("Arquitetura de Software", {
      objetiva: 8,
      verdadeiro_falso: 3,
      numerica: 2,
      dissertativa: 4,
    });
    expect(prompt).toContain("Objetivas: 8");
    expect(prompt).toContain("Verdadeiro ou falso: 3");
    expect(prompt).toContain("Numéricas: 2");
    expect(prompt).toContain("Dissertativas: 4");
    expect(prompt).toContain("Gere exatamente as quantidades informadas acima");
    expect(prompt).toContain("TEMPLATE JSON COMPLETO");
  });

  it("requires a standalone JSON file as the LLM response", () => {
    const prompt = buildImportPrompt("Sistemas Operacionais");
    expect(prompt).toContain("ARQUIVO JSON OBRIGATÓRIO");
    expect(prompt).toContain("pronto para ser salvo com a extensão .json");
    expect(prompt).toContain("deve começar pelo caractere {");
    expect(prompt).toContain("Não envolva a resposta em um bloco");
    expect(prompt).toContain("parser JSON padrão");
  });

  it("places a complete four-type JSON template at the end", () => {
    const prompt = buildImportPrompt("Banco de Dados", { objetiva: 1, verdadeiro_falso: 0, numerica: 0, dissertativa: 0 });
    expect(prompt.lastIndexOf('"version": 1')).toBeGreaterThan(prompt.lastIndexOf("REVISÃO FINAL"));
    expect(prompt).toContain('"questionType": "objetiva"');
    expect(prompt).toContain('"questionType": "verdadeiro_falso"');
    expect(prompt).toContain('"questionType": "numerica"');
    expect(prompt).toContain('"questionType": "dissertativa"');
    expect(prompt).toContain('"correctAnswer": "1 2 4 7"');
  });

  it("preserves the template envelope and exact question fields", () => {
    const prompt = buildImportPrompt();
    expect(prompt).toContain('"version": 1');
    expect(prompt).toContain('"exportedAt": "2026-01-01T00:00:00.000Z"');
    expect(prompt).toContain('"questions": [');
    expect(prompt).toContain("Use exatamente os nove campos por questão");
    expect(prompt).toContain('"correctAnswer": ""');
    expect(prompt).toContain("Não adicione campos extras");
  });

  it("documents all supported question types and dynamic HTML rules", () => {
    const prompt = buildImportPrompt();
    expect(prompt).toContain('"objetiva"');
    expect(prompt).toContain('"verdadeiro_falso"');
    expect(prompt).toContain('"dissertativa"');
    expect(prompt).toContain('"numerica"');
    expect(prompt).toContain("HTML sanitizado");
    expect(prompt).toContain("<table>");
    expect(prompt).toContain("colspan");
    expect(prompt).toContain("background-color");
    expect(prompt).toContain("bloqueia <img>");
  });

  it("includes applied construction, trade-offs, diversity and final review", () => {
    const prompt = buildImportPrompt();
    expect(prompt).toContain("conteúdo → recorte específico → habilidade que será avaliada");
    expect(prompt).toContain("Sempre que possível, crie questões aplicadas");
    expect(prompt).toContain("desempenho versus custo");
    expect(prompt).toContain("Não crie duas questões que permitam ao aluno descobrir diretamente");
    expect(prompt).toContain("Evite padrões previsíveis de gabarito");
    expect(prompt).toContain("Múltiplos critérios, integração de conceitos");
    expect(prompt).toContain("o JSON está sintaticamente válido");
    expect(prompt).toContain("Retorne somente o JSON final");
    expect(prompt).toContain("DENSIDADE E PROFUNDIDADE DO ENUNCIADO");
    expect(prompt).toContain("TESTE DO CONTEXTO");
    expect(prompt).toContain("FIDELIDADE AOS MATERIAIS");
    expect(prompt).toContain("DISTRATORES E PISTAS");
  });

  it("keeps the type-specific constraints", () => {
    const prompt = buildImportPrompt();
    expect(prompt).toContain('"options" deve ser exatamente ["Verdadeiro", "Falso"]');
    expect(prompt).toContain('"answerLines" deve ficar entre 4 e 12');
    expect(prompt).toContain('"correctAnswer" deve conter somente dígitos, espaços ou vírgulas');
    expect(prompt).toContain('"options" deve ter exatamente 5 alternativas');
    expect(prompt).toContain("4 distratores plausíveis e tecnicamente relacionados");
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
