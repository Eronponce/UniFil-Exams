import { describe, expect, it } from "vitest";
import {
  buildAnswerKeySvg,
  renderAnswerKeyPng,
  resolveAnswerKeyImageAnswer,
  type AnswerKeyImageQuestion,
} from "@/lib/export/answer-key-image";

function question(overrides: Partial<AnswerKeyImageQuestion> = {}): AnswerKeyImageQuestion {
  return {
    position: 1,
    sourceQuestionId: 17,
    statementHtml: "Qual alternativa está correta?",
    questionType: "objetiva",
    options: [
      { index: 0, text: "Primeira" },
      { index: 1, text: "Segunda" },
      { index: 2, text: "Terceira" },
      { index: 3, text: "Quarta" },
      { index: 4, text: "Quinta" },
    ],
    shuffledOptions: [2, 0, 4, 1, 3],
    correctShuffledIndex: 3,
    correctAnswer: "",
    explanation: "A segunda alternativa satisfaz os critérios apresentados.",
    ...overrides,
  };
}

describe("commented answer-key image", () => {
  it("uses the displayed objective letter and True/False wording", () => {
    expect(resolveAnswerKeyImageAnswer(question())).toBe("D — Segunda");
    expect(resolveAnswerKeyImageAnswer(question({
      questionType: "verdadeiro_falso",
      shuffledOptions: [1, 0],
      correctShuffledIndex: 0,
      options: [],
    }))).toBe("False");
    expect(resolveAnswerKeyImageAnswer(question({
      questionType: "verdadeiro_falso",
      shuffledOptions: [1, 0],
      correctShuffledIndex: 1,
      options: [],
    }))).toBe("True");
  });

  it("builds a branded, escaped SVG with the justification and version", () => {
    const { svg, width, height } = buildAnswerKeySvg({
      examTitle: "Prova <Final>",
      institution: "UniFil & Curso",
      setLabel: "B",
      versionNumber: 4,
      questions: [question({ explanation: "Justificativa <strong>segura</strong> & completa" })],
    });

    expect(width).toBe(1400);
    expect(height).toBeGreaterThan(500);
    expect(svg).toContain("GABARITO COMENTADO");
    expect(svg).toContain("ENUNCIADO");
    expect(svg).toContain("Prova &lt;Final&gt;");
    expect(svg).toContain("UniFil &amp; Curso  •  Set B  •  Versão 4");
    expect(svg).toContain("D — Segunda");
    expect(svg).toContain("Justificativa segura &amp; completa");
    expect(svg).not.toContain("<Final>");
  });

  it("keeps long statements readable without the old 520-character truncation", () => {
    const statement = `${"Contexto detalhado para leitura confortável. ".repeat(18)}MARCADOR_FINAL_DO_ENUNCIADO`;
    const { svg, height } = buildAnswerKeySvg({
      examTitle: "Prova extensa",
      institution: "UniFil",
      setLabel: "A",
      questions: [question({ statementHtml: statement })],
    });

    expect(statement.length).toBeGreaterThan(520);
    expect(svg).toContain("MARCADOR_FINAL_DO_ENUNCIADO");
    expect(svg).toContain('class="statement-label">ENUNCIADO</text>');
    expect(height).toBeGreaterThan(1_000);
  });

  it("preserves readable spacing between rich-text blocks", () => {
    const { svg } = buildAnswerKeySvg({
      examTitle: "Prova HTML",
      institution: "UniFil",
      setLabel: "A",
      questions: [question({
        statementHtml: "<p>Primeiro parágrafo.</p><p>Segundo parágrafo.</p><ul><li>Item um</li><li>Item dois</li></ul>",
      })],
    });

    expect(svg).toContain("Primeiro parágrafo. Segundo parágrafo. Item um Item dois");
    expect(svg).not.toContain("parágrafo.Segundo");
  });

  it("renders a real PNG payload", async () => {
    const png = await renderAnswerKeyPng({
      examTitle: "Teste de conhecimentos",
      institution: "UniFil",
      setLabel: "A",
      questions: [question()],
    });

    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.byteLength).toBeGreaterThan(1_000);
  });
});
