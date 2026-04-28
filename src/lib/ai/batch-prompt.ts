import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AIProvider } from "./generate";
import { buildBatchQuestionPrompt } from "./prompt-templates";
import type { QuestionType } from "@/types";
import type { AITrace, TraceRound } from "./trace";

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

const optionText = z.string().transform((s) => s.replace(/^[A-Ea-e1-5][\)\.\-]\s*/, "").trim());

const ObjetivaSchema = z.object({
  questions: z.array(
    z.object({
      statement: z.string().min(10),
      options: z.tuple([optionText, optionText, optionText, optionText, optionText]),
      correctIndex: z.number().int().min(0).max(4),
      explanation: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      thematicArea: z.string().optional(),
      thematic_area: z.string().optional(),
      answerLines: z.number().int().optional(),
    }),
  ).min(1),
});

const VFSchema = z.object({
  questions: z.array(
    z.object({
      statement: z.string().min(5),
      correctIndex: z.number().int().min(0).max(1).optional(),
      isTrue: z.boolean().optional(),
      explanation: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      thematicArea: z.string().optional(),
      thematic_area: z.string().optional(),
      answerLines: z.number().int().optional(),
    }),
  ).min(1),
});

const DissertativaSchema = z.object({
  questions: z.array(
    z.object({
      statement: z.string().min(10),
      answerLines: z.number().int().min(1).max(20).default(6),
      explanation: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      thematicArea: z.string().optional(),
      thematic_area: z.string().optional(),
    }),
  ).min(1),
});

function promptObjetivaFull(discipline: string, rawText: string): string {
  return buildBatchQuestionPrompt(discipline, rawText, "objetiva", "full");
}

function promptObjetivaSimple(discipline: string, rawText: string): string {
  return buildBatchQuestionPrompt(discipline, rawText, "objetiva", "simple");
}

function promptObjetivaMinimal(discipline: string, rawText: string): string {
  return buildBatchQuestionPrompt(discipline, rawText, "objetiva", "minimal");
}

function promptVFFull(discipline: string, rawText: string): string {
  return buildBatchQuestionPrompt(discipline, rawText, "verdadeiro_falso", "full");
}

function promptVFSimple(discipline: string, rawText: string): string {
  return buildBatchQuestionPrompt(discipline, rawText, "verdadeiro_falso", "simple");
}

function promptVFMinimal(discipline: string, rawText: string): string {
  return buildBatchQuestionPrompt(discipline, rawText, "verdadeiro_falso", "minimal");
}

function promptDissertativaFull(discipline: string, rawText: string): string {
  return buildBatchQuestionPrompt(discipline, rawText, "dissertativa", "full");
}

function promptDissertativaSimple(discipline: string, rawText: string): string {
  return buildBatchQuestionPrompt(discipline, rawText, "dissertativa", "simple");
}

function promptDissertativaMinimal(discipline: string, rawText: string): string {
  return buildBatchQuestionPrompt(discipline, rawText, "dissertativa", "minimal");
}

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

function getThematicArea(question: { thematicArea?: string; thematic_area?: string }): string | undefined {
  return question.thematicArea ?? question.thematic_area ?? undefined;
}

async function attemptObjetiva(model: ReturnType<typeof getModel>, prompt: string): Promise<BatchGeneratedQuestion[]> {
  const { object } = await generateObject({ model, schema: ObjetivaSchema, prompt, maxRetries: 0 });
  return object.questions.map((q) => ({
    statement: q.statement,
    questionType: "objetiva" as const,
    options: [...q.options],
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    difficulty: q.difficulty,
    thematicArea: getThematicArea(q),
    answerLines: 0,
  }));
}

async function attemptVF(model: ReturnType<typeof getModel>, prompt: string): Promise<BatchGeneratedQuestion[]> {
  const { object } = await generateObject({ model, schema: VFSchema, prompt, maxRetries: 0 });
  return object.questions.map((q) => {
    const isTrue = typeof q.correctIndex === "number" ? q.correctIndex === 0 : q.isTrue ?? true;
    return {
      statement: q.statement,
      questionType: "verdadeiro_falso" as const,
      options: ["Verdadeiro", "Falso"],
      correctIndex: isTrue ? 0 : 1,
      explanation: q.explanation,
      difficulty: q.difficulty,
      thematicArea: getThematicArea(q),
      answerLines: 0,
    };
  });
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
    thematicArea: getThematicArea(q),
    answerLines: q.answerLines,
  }));
}

export async function generateBatchQuestions(
  discipline: string,
  rawText: string,
  provider: AIProvider,
  questionType: QuestionType = "objetiva",
  ollamaModel?: string,
  onProgress?: (progress: BatchGenerationProgress) => void,
): Promise<BatchGenerationResult> {
  const model = getModel(provider, ollamaModel);

  const [prompts, attemptFn]: [
    ((d: string, t: string) => string)[],
    (m: ReturnType<typeof getModel>, p: string) => Promise<BatchGeneratedQuestion[]>,
  ] =
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

    await Promise.any([attemptFn(model, prompt), attemptFn(model, prompt)])
      .then((r) => {
        result = r;
      })
      .catch((agg: AggregateError) => {
        roundError = agg.errors.map((e: unknown) => (e instanceof Error ? e.message : String(e))).join(" | ");
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
      message: result ? `Rodada ${round + 1} concluida com sucesso` : `Rodada ${round + 1} falhou`,
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
  throw Object.assign(new Error("Nao foi possivel gerar questoes validas apos 3 rodadas (6 tentativas)."), {
    trace: errorTrace,
  });
}
