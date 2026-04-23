import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AIProvider } from "./generate";
import type { QuestionType } from "@/types";
import type { AITrace, TraceRound } from "./trace";

// ── Result type ────────────────────────────────────────────────────────────────
export interface BatchGenerationResult {
  questions: BatchGeneratedQuestion[];
  trace: AITrace;
}

export interface BatchGenerationProgress {
  trace: AITrace;
  phase: "round-start" | "round-success" | "round-failure";
  round: number;
  message: string;
}

// ── Types ──────────────────────────────────────────────────────────────────────
export type BatchGeneratedQuestion = {
  statement: string;
  questionType: QuestionType;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
  thematicArea?: string;
  answerLines?: number;
};

// ── Zod schemas ────────────────────────────────────────────────────────────────
const optionText = z.string().transform((s) => s.replace(/^[A-Ea-e1-5][\)\.\-]\s*/, "").trim());

const ObjetivaSchema = z.object({
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

const VFSchema = z.object({
  questions: z.array(
    z.object({
      statement: z.string().min(5),
      isTrue: z.boolean(),
      explanation: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      thematic_area: z.string().optional(),
    })
  ).min(1),
});

const DissertativaSchema = z.object({
  questions: z.array(
    z.object({
      statement: z.string().min(10),
      answerLines: z.number().int().min(1).max(20).default(6),
      explanation: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      thematic_area: z.string().optional(),
    })
  ).min(1),
});

// ── Objetiva prompts ───────────────────────────────────────────────────────────
function promptObjetivaFull(discipline: string, rawText: string): string {
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

function promptObjetivaSimple(discipline: string, rawText: string): string {
  return `Disciplina: ${discipline}

Para cada tópico/questão do texto abaixo, gere uma questão de múltipla escolha com 5 alternativas.
Retorne JSON com array "questions". Cada item: statement, options (array de 5 strings sem letra prefixo), correctIndex (0-4), explanation, difficulty (easy/medium/hard), thematic_area.

Texto:
${rawText}`;
}

function promptObjetivaMinimal(discipline: string, rawText: string): string {
  return `Gere questões de múltipla escolha sobre "${discipline}" baseadas no texto abaixo.
JSON: {"questions":[{"statement":"...","options":["op1","op2","op3","op4","op5"],"correctIndex":0,"explanation":"...","difficulty":"medium","thematic_area":"..."}]}

Texto: ${rawText}`;
}

// ── V/F prompts ────────────────────────────────────────────────────────────────
function promptVFFull(discipline: string, rawText: string): string {
  return `Você é um especialista na disciplina "${discipline}" criando questões de prova universitárias.

Analise o texto abaixo. Para CADA proposição ou tópico identificado, crie UMA proposição de Verdadeiro ou Falso.
Misture proposições verdadeiras e falsas (não coloque todas iguais).

Regras:
- statement deve ser uma afirmação completa, não uma pergunta
- isTrue: true se a afirmação é correta, false se é incorreta
- difficulty: easy|medium|hard

Texto:
${rawText}`;
}

function promptVFSimple(discipline: string, rawText: string): string {
  return `Disciplina: ${discipline}

Para cada item do texto, gere uma proposição V/F. Misture verdadeiras e falsas.
Retorne JSON com array "questions". Cada item: statement (afirmação, não pergunta), isTrue (bool), explanation, difficulty (easy/medium/hard), thematic_area.

Texto:
${rawText}`;
}

function promptVFMinimal(discipline: string, rawText: string): string {
  return `Gere proposições V/F sobre "${discipline}". Misture verdadeiras e falsas.
JSON: {"questions":[{"statement":"...","isTrue":true,"explanation":"...","difficulty":"medium","thematic_area":"..."}]}

Texto: ${rawText}`;
}

// ── Dissertativa prompts ───────────────────────────────────────────────────────
function promptDissertativaFull(discipline: string, rawText: string): string {
  return `Você é um especialista na disciplina "${discipline}" criando questões de prova universitárias.

Analise o texto abaixo. Para CADA tópico identificado, crie UMA questão dissertativa que estimule resposta elaborada.

Regras:
- statement deve ser questão aberta (use 'Explique', 'Descreva', 'Compare', 'Justifique')
- answerLines: linhas em branco necessárias para resposta (inteiro 4–20)
- difficulty: easy|medium|hard

Texto:
${rawText}`;
}

function promptDissertativaSimple(discipline: string, rawText: string): string {
  return `Disciplina: ${discipline}

Para cada tópico do texto, gere uma questão dissertativa aberta.
Retorne JSON com array "questions". Cada item: statement (questão aberta), answerLines (int 4-20), explanation, difficulty (easy/medium/hard), thematic_area.

Texto:
${rawText}`;
}

function promptDissertativaMinimal(discipline: string, rawText: string): string {
  return `Gere questões dissertativas sobre "${discipline}".
JSON: {"questions":[{"statement":"...","answerLines":8,"explanation":"...","difficulty":"medium","thematic_area":"..."}]}

Texto: ${rawText}`;
}

// ── Model factory ──────────────────────────────────────────────────────────────
function getModel(provider: AIProvider, ollamaModel?: string) {
  switch (provider) {
    case "ollama": {
      const baseURL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434") + "/v1";
      const model = ollamaModel ?? process.env.OLLAMA_MODEL ?? "qwen2.5:latest";
      return createOpenAICompatible({ name: "ollama", baseURL })(model);
    }
    case "claude":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })("claude-haiku-4-5-20251001");
    case "gemini":
      return createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })("gemini-2.0-flash");
  }
}

// ── Attempt helpers ────────────────────────────────────────────────────────────
async function attemptObjetiva(model: ReturnType<typeof getModel>, prompt: string): Promise<BatchGeneratedQuestion[]> {
  const { object } = await generateObject({ model, schema: ObjetivaSchema, prompt, maxRetries: 0 });
  return object.questions.map((q) => ({
    statement: q.statement,
    questionType: "objetiva" as const,
    options: [...q.options],
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    difficulty: q.difficulty,
    thematicArea: q.thematic_area ?? undefined,
    answerLines: 0,
  }));
}

async function attemptVF(model: ReturnType<typeof getModel>, prompt: string): Promise<BatchGeneratedQuestion[]> {
  const { object } = await generateObject({ model, schema: VFSchema, prompt, maxRetries: 0 });
  return object.questions.map((q) => ({
    statement: q.statement,
    questionType: "verdadeiro_falso" as const,
    options: ["Verdadeiro", "Falso"],
    correctIndex: q.isTrue ? 0 : 1,
    explanation: q.explanation,
    difficulty: q.difficulty,
    thematicArea: q.thematic_area ?? undefined,
    answerLines: 0,
  }));
}

async function attemptDissertativa(model: ReturnType<typeof getModel>, prompt: string): Promise<BatchGeneratedQuestion[]> {
  const { object } = await generateObject({ model, schema: DissertativaSchema, prompt, maxRetries: 0 });
  return object.questions.map((q) => ({
    statement: q.statement,
    questionType: "dissertativa" as const,
    options: [],
    correctIndex: 0,
    explanation: q.explanation,
    difficulty: q.difficulty,
    thematicArea: q.thematic_area ?? undefined,
    answerLines: q.answerLines,
  }));
}

// ── Main ───────────────────────────────────────────────────────────────────────
export async function generateBatchQuestions(
  discipline: string,
  rawText: string,
  provider: AIProvider,
  questionType: QuestionType = "objetiva",
  ollamaModel?: string,
  onProgress?: (progress: BatchGenerationProgress) => void,
): Promise<BatchGenerationResult> {
  const model = getModel(provider, ollamaModel);

  const [prompts, attemptFn]: [((d: string, t: string) => string)[], (m: ReturnType<typeof getModel>, p: string) => Promise<BatchGeneratedQuestion[]>] =
    questionType === "verdadeiro_falso"
      ? [[promptVFFull, promptVFSimple, promptVFMinimal], attemptVF]
      : questionType === "dissertativa"
      ? [[promptDissertativaFull, promptDissertativaSimple, promptDissertativaMinimal], attemptDissertativa]
      : [[promptObjetivaFull, promptObjetivaSimple, promptObjetivaMinimal], attemptObjetiva];

  const traceRounds: TraceRound[] = [];

  for (let round = 0; round < prompts.length; round++) {
    const prompt = prompts[round]!(discipline, rawText);
    traceRounds.push({
      round: round + 1,
      prompt,
      succeeded: false,
    });
    onProgress?.({
      phase: "round-start",
      round: round + 1,
      message: `Rodada ${round + 1} iniciada`,
      trace: {
        provider,
        model: provider === "ollama" ? (ollamaModel ?? process.env.OLLAMA_MODEL ?? "qwen2.5:latest") : undefined,
        questionType,
        rounds: [...traceRounds],
        succeededRound: null,
      },
    });

    let result: BatchGeneratedQuestion[] | null = null;
    let roundError: string | undefined;

    await Promise.any([
      attemptFn(model, prompt),
      attemptFn(model, prompt),
    ]).then((r) => { result = r; })
      .catch((agg: AggregateError) => {
        roundError = agg.errors.map((e: unknown) => e instanceof Error ? e.message : String(e)).join(" | ");
      });

    traceRounds[round] = {
      ...traceRounds[round],
      resultJson: result ? JSON.stringify(result, null, 2) : undefined,
      error: roundError,
      succeeded: result !== null,
    };

    onProgress?.({
      phase: result ? "round-success" : "round-failure",
      round: round + 1,
      message: result ? `Rodada ${round + 1} concluída com sucesso` : `Rodada ${round + 1} falhou`,
      trace: {
        provider,
        model: provider === "ollama" ? (ollamaModel ?? process.env.OLLAMA_MODEL ?? "qwen2.5:latest") : undefined,
        questionType,
        rounds: [...traceRounds],
        succeededRound: result ? round + 1 : null,
      },
    });

    if (result) {
      return {
        questions: result,
        trace: {
          provider,
          model: provider === "ollama" ? (ollamaModel ?? process.env.OLLAMA_MODEL ?? "qwen2.5:latest") : undefined,
          questionType,
          rounds: traceRounds,
          succeededRound: round + 1,
        },
      };
    }
  }

  const errorTrace: AITrace = {
    provider,
    model: provider === "ollama" ? (ollamaModel ?? process.env.OLLAMA_MODEL ?? "qwen2.5:latest") : undefined,
    questionType,
    rounds: traceRounds,
    succeededRound: null,
  };
  throw Object.assign(
    new Error(`Não foi possível gerar questões válidas após 3 rodadas (6 tentativas).`),
    { trace: errorTrace },
  );
}
