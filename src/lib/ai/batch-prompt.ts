import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AIProvider } from "./generate";

// ── Zod schema ────────────────────────────────────────────────────────────────
const optionText = z.string().transform((s) => s.replace(/^[A-Ea-e1-5][\)\.\-]\s*/, "").trim());

const QuestionSchema = z.object({
  questions: z.array(
    z.object({
      statement: z.string().min(10),
      options: z.tuple([optionText, optionText, optionText, optionText, optionText]),
      correctIndex: z.number().int().min(0).max(4),
      explanation: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      thematic_area: z.string().optional(),
    })
  ).min(1),
});

export type BatchGeneratedQuestion = {
  statement: string;
  options: [string, string, string, string, string];
  correctIndex: number;
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
  thematicArea?: string;
};

// ── Prompts ────────────────────────────────────────────────────────────────────
// Round 1 — full prompt with context
function promptFull(discipline: string, rawText: string): string {
  return `Você é um especialista na disciplina "${discipline}" criando questões de prova objetivas universitárias.

Analise o texto abaixo. Para CADA questão ou tópico identificado:
1. Extraia ou formule o ENUNCIADO (ignore qualquer alternativa já existente no texto)
2. Crie 5 alternativas NOVAS: 1 correta + 4 distratores baseados em erros conceituais reais de estudantes
3. Coloque a correta em um índice variado (não sempre 0)
4. Escreva justificativa explicando por que a correta está certa e os distratores estão errados

Regras: IGNORE alternativas existentes; sem prefixos A), B) nas alternativas; difficulty: easy|medium|hard.

Texto:
${rawText}`;
}

// Round 2 — prompt simplificado para quando o modelo travar no schema
function promptSimple(discipline: string, rawText: string): string {
  return `Disciplina: ${discipline}

Para cada tópico/questão do texto abaixo, gere uma questão de múltipla escolha com 5 alternativas.
Retorne JSON com array "questions". Cada item: statement, options (array de 5 strings sem letra prefixo), correctIndex (0-4), explanation, difficulty (easy/medium/hard), thematic_area.

Texto:
${rawText}`;
}

// Round 3 — prompt mínimo, mais tolerante
function promptMinimal(discipline: string, rawText: string): string {
  return `Gere questões de múltipla escolha sobre "${discipline}" baseadas no texto abaixo.
JSON: {"questions":[{"statement":"...","options":["op1","op2","op3","op4","op5"],"correctIndex":0,"explanation":"...","difficulty":"medium","thematic_area":"..."}]}

Texto: ${rawText}`;
}

const ROUND_PROMPTS = [promptFull, promptSimple, promptMinimal];

// ── Model factory ──────────────────────────────────────────────────────────────
function getModel(provider: AIProvider) {
  switch (provider) {
    case "ollama": {
      const baseURL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434") + "/v1";
      const model = process.env.OLLAMA_MODEL ?? "qwen2.5:latest";
      return createOpenAICompatible({ name: "ollama", baseURL })(model);
    }
    case "claude":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })("claude-haiku-4-5-20251001");
    case "gemini":
      return createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })("gemini-2.0-flash");
  }
}

// ── Single attempt ─────────────────────────────────────────────────────────────
async function attempt(model: ReturnType<typeof getModel>, prompt: string): Promise<BatchGeneratedQuestion[]> {
  const { object } = await generateObject({ model, schema: QuestionSchema, prompt, maxRetries: 0 });
  return object.questions.map((q) => ({
    statement: q.statement,
    options: q.options as [string, string, string, string, string],
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    difficulty: q.difficulty,
    thematicArea: q.thematic_area ?? undefined,
  }));
}

// ── Main: 3 rounds × 2 parallel agents each ───────────────────────────────────
export async function generateBatchQuestions(
  discipline: string,
  rawText: string,
  provider: AIProvider
): Promise<BatchGeneratedQuestion[]> {
  const model = getModel(provider);
  const errors: string[] = [];

  for (let round = 0; round < ROUND_PROMPTS.length; round++) {
    const prompt = ROUND_PROMPTS[round]!(discipline, rawText);

    // Two parallel agents per round — first to succeed wins
    const result = await Promise.any([
      attempt(model, prompt),
      attempt(model, prompt),
    ]).catch((agg: AggregateError) => {
      errors.push(`Rodada ${round + 1}: ${agg.errors.map((e: unknown) => e instanceof Error ? e.message : String(e)).join(" | ")}`);
      return null;
    });

    if (result) return result;
  }

  // All 6 attempts failed
  throw new Error(`Não foi possível gerar questões válidas após 3 rodadas (6 tentativas).\n${errors.join("\n")}`);
}
