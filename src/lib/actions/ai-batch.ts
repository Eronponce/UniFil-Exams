"use server";

import { generateBatchQuestions, type BatchGeneratedQuestion } from "@/lib/ai/batch-prompt";
import { getDiscipline } from "@/lib/db/disciplines";
import type { AIProvider } from "@/lib/ai/generate";
import type { AITrace } from "@/lib/ai/trace";
import type { QuestionType } from "@/types";

export interface BatchState {
  results?: BatchGeneratedQuestion[];
  trace?: AITrace;
  error?: string;
  disciplineId?: number;
}

export async function batchGenerateAction(_prev: BatchState, formData: FormData): Promise<BatchState> {
  const disciplineId = Number(formData.get("disciplineId"));
  const provider = (formData.get("provider") as AIProvider) ?? "ollama";
  const rawText = (formData.get("rawText") as string | null)?.trim() ?? "";
  const questionType = (formData.get("questionType") as QuestionType) ?? "objetiva";
  const ollamaModel = (formData.get("ollamaModel") as string | null)?.trim() || undefined;

  if (!disciplineId || !rawText) return { error: "Disciplina e texto são obrigatórios." };

  const discipline = getDiscipline(disciplineId);
  if (!discipline) return { error: "Disciplina não encontrada." };

  try {
    const { questions, trace } = await generateBatchQuestions(discipline.name, rawText, provider, questionType, ollamaModel);
    return { results: questions, trace, disciplineId };
  } catch (err) {
    const trace = (err as Record<string, unknown>).trace as AITrace | undefined;
    return { error: err instanceof Error ? err.message : "Erro ao gerar questões.", trace };
  }
}
