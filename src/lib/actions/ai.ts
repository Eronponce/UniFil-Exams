"use server";

import { generateQuestion, type AIProvider } from "@/lib/ai/generate";
import type { GeneratedQuestion } from "@/lib/ai/prompt";
import type { AITrace } from "@/lib/ai/trace";
import { getDiscipline } from "@/lib/db/disciplines";
import type { QuestionType } from "@/types";

export interface GenerationState {
  result?: GeneratedQuestion & { disciplineId: number };
  trace?: AITrace;
  error?: string;
}

export async function generateQuestionAction(_prev: GenerationState, formData: FormData): Promise<GenerationState> {
  const disciplineId = Number(formData.get("disciplineId"));
  const provider = (formData.get("provider") as AIProvider) ?? "ollama";
  const topic = (formData.get("topic") as string | null)?.trim() ?? "";
  const questionType = (formData.get("questionType") as QuestionType) ?? "objetiva";
  const ollamaModel = (formData.get("ollamaModel") as string | null)?.trim() || undefined;

  if (!disciplineId || !topic) return { error: "Disciplina e tema são obrigatórios." };

  const discipline = getDiscipline(disciplineId);
  if (!discipline) return { error: "Disciplina não encontrada." };

  try {
    const { question, trace } = await generateQuestion(provider, discipline.name, topic, questionType, ollamaModel);
    return { result: { ...question, disciplineId }, trace };
  } catch (err) {
    const trace = (err as Record<string, unknown>).trace as AITrace | undefined;
    return { error: err instanceof Error ? err.message : "Erro ao gerar questão.", trace };
  }
}
