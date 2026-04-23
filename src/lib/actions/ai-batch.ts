"use server";

import { generateBatchQuestions, type BatchGeneratedQuestion } from "@/lib/ai/batch-prompt";
import { getDiscipline } from "@/lib/db/disciplines";
import type { AIProvider } from "@/lib/ai/generate";

export interface BatchState {
  results?: BatchGeneratedQuestion[];
  error?: string;
  disciplineId?: number;
}

export async function batchGenerateAction(_prev: BatchState, formData: FormData): Promise<BatchState> {
  const disciplineId = Number(formData.get("disciplineId"));
  const provider = (formData.get("provider") as AIProvider) ?? "ollama";
  const rawText = (formData.get("rawText") as string | null)?.trim() ?? "";

  if (!disciplineId || !rawText) return { error: "Disciplina e texto são obrigatórios." };

  const discipline = getDiscipline(disciplineId);
  if (!discipline) return { error: "Disciplina não encontrada." };

  try {
    const results = await generateBatchQuestions(discipline.name, rawText, provider);
    return { results, disciplineId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao gerar questões." };
  }
}
