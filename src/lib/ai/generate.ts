import { callOllama } from "./providers/ollama";
import { callClaude } from "./providers/claude";
import { callGemini } from "./providers/gemini";
import {
  buildPrompt, buildPromptVF, buildPromptDissertativa,
  parseResponse, parseResponseVF, parseResponseDissertativa,
  type GeneratedQuestion,
} from "./prompt";
import type { AITrace } from "./trace";
import type { QuestionType } from "@/types";

export type AIProvider = "ollama" | "claude" | "gemini";

export interface GenerationResult {
  question: GeneratedQuestion;
  trace: AITrace;
}

export async function generateQuestion(
  provider: AIProvider,
  discipline: string,
  topic: string,
  questionType: QuestionType = "objetiva",
  ollamaModel?: string,
): Promise<GenerationResult> {
  const promptFn = questionType === "verdadeiro_falso" ? buildPromptVF
    : questionType === "dissertativa" ? buildPromptDissertativa
    : buildPrompt;
  const parser = questionType === "verdadeiro_falso" ? parseResponseVF
    : questionType === "dissertativa" ? parseResponseDissertativa
    : parseResponse;

  const prompt = promptFn(discipline, topic);

  let rawResponse: string;
  if (provider === "claude") rawResponse = await callClaude(prompt);
  else if (provider === "gemini") rawResponse = await callGemini(prompt);
  else rawResponse = await callOllama(prompt, 1024, ollamaModel);

  let question: GeneratedQuestion;
  try {
    question = parser(rawResponse);
  } catch (error) {
    const trace: AITrace = {
      provider,
      model: provider === "ollama" ? (ollamaModel ?? process.env.OLLAMA_MODEL ?? "qwen2.5:latest") : undefined,
      questionType,
      succeededRound: null,
      rounds: [{
        round: 1,
        prompt,
        rawResponse,
        error: error instanceof Error ? error.message : "Falha ao interpretar a resposta da IA.",
        succeeded: false,
      }],
    };

    throw Object.assign(
      new Error(error instanceof Error ? error.message : "Erro ao processar resposta da IA."),
      { trace },
    );
  }

  const trace: AITrace = {
    provider,
    model: provider === "ollama" ? (ollamaModel ?? process.env.OLLAMA_MODEL ?? "qwen2.5:latest") : undefined,
    questionType,
    succeededRound: 1,
    rounds: [{
      round: 1,
      prompt,
      rawResponse,
      resultJson: JSON.stringify(question, null, 2),
      succeeded: true,
    }],
  };

  return { question, trace };
}
