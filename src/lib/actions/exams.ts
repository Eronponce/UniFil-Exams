"use server";

import { revalidatePath } from "next/cache";
import { createExam, createExamSet } from "@/lib/db/exams";
import { getQuestion } from "@/lib/db/questions";
import { buildSets, type QuestionInfo } from "@/lib/exam/randomize";
import { normalizeExamSelectionRequest, pickQuestionsForExam } from "@/lib/exam/select-questions";
import { redirectWithToast } from "@/lib/toast";

const SET_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export async function createExamAction(formData: FormData) {
  const disciplineId = Number(formData.get("disciplineId"));
  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const institution = (formData.get("institution") as string | null)?.trim() || "UniFil - Centro Universitário Filadélfia";
  const allQuestionIds = (formData.getAll("questionIds") as string[]).map(Number).filter(Boolean);
  const qty = Math.min(Math.max(Number(formData.get("quantitySets")) || 1, 1), 8);
  const labels = SET_LETTERS.slice(0, qty);

  if (!disciplineId || !title || allQuestionIds.length === 0) {
    redirectWithToast("/exams?error=campos-obrigatorios", {
      type: "error",
      title: "Dados incompletos",
      description: "Escolha a disciplina, o título e ao menos uma questão.",
    });
  }

  const questionInfos: QuestionInfo[] = allQuestionIds
    .map((id) => getQuestion(id))
    .filter(Boolean)
    .map((q) => ({ id: q!.id, correctIndex: q!.correctIndex, questionType: q!.questionType }));

  let selectedQuestionInfos: QuestionInfo[];
  try {
    selectedQuestionInfos = pickQuestionsForExam(questionInfos, normalizeExamSelectionRequest(formData));
  } catch (error) {
    redirectWithToast(`/exams?discipline=${disciplineId}&error=${encodeURIComponent(error instanceof Error ? error.message : "Seleção inválida")}`, {
      type: "error",
      title: "Seleção de questões inválida",
      description: error instanceof Error ? error.message : "Revise as quantidades por tipo.",
    });
  }

  if (selectedQuestionInfos.length === 0) {
    redirectWithToast(`/exams?discipline=${disciplineId}&error=nenhuma-questao`, {
      type: "error",
      title: "Nenhuma questão selecionada",
      description: "As quantidades informadas geraram uma prova vazia.",
    });
  }

  const exam = createExam({ disciplineId, title, institution, questionIds: selectedQuestionInfos.map((q) => q.id) });
  const sets = buildSets(selectedQuestionInfos, labels);

  for (const s of sets) {
    createExamSet(exam.id, {
      label: s.label,
      questionOrder: s.questionOrder,
      shuffledOptions: s.shuffledOptions,
      correctShuffledIndices: s.correctShuffledIndices,
    });
  }

  revalidatePath("/exams");
  revalidatePath("/exports");
  revalidatePath("/");
  redirectWithToast(`/exports?exam=${exam.id}&new=1`, {
    type: "success",
    title: "Prova criada",
    description: `${selectedQuestionInfos.length} questão(ões) distribuídas em ${qty} set(s).`,
  });
}
