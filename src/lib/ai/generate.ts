import { generateWithOllama } from "./providers/ollama";
import { generateWithClaude } from "./providers/claude";
import { generateWithGemini } from "./providers/gemini";
import type { GeneratedQuestion } from "./prompt";

export type AIProvider = "ollama" | "claude" | "gemini";

export async function generateQuestion(provider: AIProvider, discipline: string, topic: string): Promise<GeneratedQuestion> {
  switch (provider) {
    case "ollama":
      return generateWithOllama(discipline, topic);
    case "claude":
      return generateWithClaude(discipline, topic);
    case "gemini":
      return generateWithGemini(discipline, topic);
  }
}
