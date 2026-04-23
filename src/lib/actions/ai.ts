"use server";

import { generateQuestion, type AIProvider } from "@/lib/ai/generate";
import type { GeneratedQuestion } from "@/lib/ai/prompt";
import { getDiscipline } from "@/lib/db/disciplines";

export interface GenerationState {
  result?: GeneratedQuestion & { disciplineId: number };
  error?: string;
}

export async function generateQuestionAction(_prev: GenerationState, formData: FormData): Promise<GenerationState> {
  const disciplineId = Number(formData.get("disciplineId"));
  const provider = (formData.get("provider") as AIProvider) ?? "ollama";
  const topic = (formData.get("topic") as string | null)?.trim() ?? "";

  if (!disciplineId || !topic) return { error: "Disciplina e tema são obrigatórios." };

  const discipline = getDiscipline(disciplineId);
  if (!discipline) return { error: "Disciplina não encontrada." };

  try {
    const result = await generateQuestion(provider, discipline.name, topic);
    return { result: { ...result, disciplineId } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao gerar questão." };
  }
}
