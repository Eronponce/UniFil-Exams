"use server";

import { revalidatePath } from "next/cache";
import { enqueueTask, cancelTask } from "@/lib/task-queue";
import { getQuestion } from "@/lib/db/questions";
import type { QuestionType } from "@/types";

export async function enqueueAuditAction(questionId: number, value: boolean): Promise<{ taskId: string; isNew: boolean; error?: string }> {
  const q = getQuestion(questionId);
  if (!q) return { taskId: "", isNew: false, error: "Questão não encontrada." };

  const { task, isNew } = enqueueTask({
    type: "audit",
    label: `Auditoria: ${q.statement.slice(0, 60)}`,
    dedupKey: `audit-${questionId}`,
    payload: { questionId, value },
  });

  revalidatePath("/audit");
  revalidatePath("/questions");
  revalidatePath("/");

  return { taskId: task.id, isNew };
}

export async function enqueueAiGenerationAction(params: {
  disciplineName: string;
  disciplineId: number;
  rawText: string;
  provider: string;
  questionType: QuestionType;
  ollamaModel?: string;
}): Promise<{ taskId: string; isNew: boolean; error?: string }> {
  if (!params.rawText.trim()) return { taskId: "", isNew: false, error: "Texto de entrada vazio." };
  if (!params.disciplineId) return { taskId: "", isNew: false, error: "Disciplina não selecionada." };

  const dedupKey = `ai-generate-${params.disciplineId}-${params.questionType}-${params.rawText.slice(0, 40)}`;

  const { task, isNew } = enqueueTask({
    type: "ai-generate",
    label: `Gerar (${params.questionType}) — ${params.disciplineName}`,
    dedupKey,
    payload: {
      disciplineName: params.disciplineName,
      disciplineId: params.disciplineId,
      rawText: params.rawText,
      provider: params.provider,
      questionType: params.questionType,
      ollamaModel: params.ollamaModel,
    },
  });

  return { taskId: task.id, isNew };
}

export async function enqueueSingleAiGenerationAction(params: {
  disciplineName: string;
  disciplineId: number;
  topic: string;
  provider: string;
  questionType: QuestionType;
  ollamaModel?: string;
}): Promise<{ taskId: string; isNew: boolean; error?: string }> {
  if (!params.topic.trim()) return { taskId: "", isNew: false, error: "Tema de entrada vazio." };
  if (!params.disciplineId) return { taskId: "", isNew: false, error: "Disciplina não selecionada." };

  const dedupKey = `ai-single-${params.disciplineId}-${params.questionType}-${params.topic.slice(0, 40)}`;

  const { task, isNew } = enqueueTask({
    type: "ai-generate-single",
    label: `Gerar questão (${params.questionType}) — ${params.disciplineName}`,
    dedupKey,
    payload: {
      disciplineName: params.disciplineName,
      disciplineId: params.disciplineId,
      topic: params.topic,
      provider: params.provider,
      questionType: params.questionType,
      ollamaModel: params.ollamaModel,
    },
  });

  return { taskId: task.id, isNew };
}

export async function cancelTaskAction(taskId: string): Promise<{ ok: boolean }> {
  return { ok: cancelTask(taskId) };
}
