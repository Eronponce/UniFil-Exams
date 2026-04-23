import type { AITrace } from "./trace";
import type { GeneratedQuestion } from "./prompt";
import type { BatchGeneratedQuestion } from "./batch-prompt";

export type AIStatusTone = "info" | "success" | "error" | "warning";

export interface AIStatusEvent {
  id: string;
  phase: string;
  label: string;
  detail?: string;
  tone: AIStatusTone;
  round?: number;
  timestamp: string;
}

export interface GenerateStreamRequest {
  disciplineId: number;
  provider: "ollama" | "claude" | "gemini";
  topic: string;
  questionType: "objetiva" | "verdadeiro_falso" | "dissertativa";
  ollamaModel?: string;
}

export interface BatchStreamRequest {
  disciplineId: number;
  provider: "ollama" | "claude" | "gemini";
  rawText: string;
  questionType: "objetiva" | "verdadeiro_falso" | "dissertativa";
  ollamaModel?: string;
}

export type GenerateStreamEvent =
  | { type: "status"; payload: AIStatusEvent }
  | { type: "trace"; payload: AITrace }
  | { type: "result"; payload: GeneratedQuestion & { disciplineId: number } }
  | { type: "error"; payload: { message: string; trace?: AITrace } };

export type BatchStreamEvent =
  | { type: "status"; payload: AIStatusEvent }
  | { type: "trace"; payload: AITrace }
  | { type: "results"; payload: { questions: BatchGeneratedQuestion[]; disciplineId: number } }
  | { type: "error"; payload: { message: string; trace?: AITrace } };

export function makeStatusEvent(
  phase: string,
  label: string,
  options: Partial<Pick<AIStatusEvent, "detail" | "tone" | "round">> = {},
): AIStatusEvent {
  return {
    id: `${phase}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    phase,
    label,
    detail: options.detail,
    tone: options.tone ?? "info",
    round: options.round,
    timestamp: new Date().toISOString(),
  };
}
