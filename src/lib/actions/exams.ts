"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { createExam, createExamSet, deleteExam } from "@/lib/db/exams";
import { getQuestion } from "@/lib/db/questions";
import { buildSets, type QuestionInfo } from "@/lib/exam/randomize";
import { normalizeExamSelectionRequest, pickQuestionsForExam } from "@/lib/exam/select-questions";
import { redirectWithToast } from "@/lib/toast";

const SET_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const GABARITO_EXTENSIONS = ["png", "jpg", "jpeg"] as const;

function removeExamFiles(examId: number) {
  const directory = path.join(process.cwd(), "public", "gabaritos");
  for (const extension of GABARITO_EXTENSIONS) {
    const filePath = path.join(directory, `${examId}.${extension}`);
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function createExamAction(formData: FormData) {
  const disciplineId = Number(formData.get("disciplineId"));
  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const institution = (formData.get("institution") as string | null)?.trim() || "UniFil - Centro Universitário Filadélfia";
  const quantitySetsRaw = (formData.get("quantitySets") as string | null) ?? "1";
  const numObjetivasRaw = (formData.get("numObjetivas") as string | null) ?? "";
  const numVFRaw = (formData.get("numVF") as string | null) ?? "";
  const numDissertativasRaw = (formData.get("numDissertativas") as string | null) ?? "";
  const numNumericasRaw = (formData.get("numNumericas") as string | null) ?? "";
  const allQuestionIds = (formData.getAll("questionIds") as string[]).map(Number).filter(Boolean);
  const qty = Math.min(Math.max(Number(quantitySetsRaw) || 1, 1), 8);
  const labels = SET_LETTERS.slice(0, qty);

  function buildErrorParams(error: string) {
    const params = new URLSearchParams({ error, title, institution, quantitySets: String(qty) });
    if (disciplineId) params.set("discipline", String(disciplineId));
    if (numObjetivasRaw) params.set("numObjetivas", numObjetivasRaw);
    if (numVFRaw) params.set("numVF", numVFRaw);
    if (numDissertativasRaw) params.set("numDissertativas", numDissertativasRaw);
    if (numNumericasRaw) params.set("numNumericas", numNumericasRaw);
    return params;
  }

  if (!disciplineId || !title || allQuestionIds.length === 0) {
    const params = buildErrorParams("campos-obrigatorios");
    redirectWithToast(`/exams?${params.toString()}`, {
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
    const msg = error instanceof Error ? error.message : "Seleção inválida";
    const params = buildErrorParams(msg);
    redirectWithToast(`/exams?${params.toString()}`, {
      type: "error",
      title: "Seleção de questões inválida",
      description: msg,
    });
  }

  if (selectedQuestionInfos.length === 0) {
    const params = buildErrorParams("nenhuma-questao");
    redirectWithToast(`/exams?${params.toString()}`, {
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

export async function deleteExamAction(formData: FormData) {
  const examId = Number(formData.get("id"));
  if (!Number.isInteger(examId) || examId <= 0) {
    redirectWithToast("/exams", {
      type: "error",
      title: "Prova inválida",
      description: "Não foi possível identificar a prova para exclusão.",
    });
  }

  const deleted = deleteExam(examId);
  if (!deleted) {
    redirectWithToast("/exams", {
      type: "error",
      title: "Prova não encontrada",
      description: "A prova já foi removida ou não existe mais.",
    });
  }

  removeExamFiles(examId);
  revalidatePath("/exams");
  revalidatePath("/exports");
  revalidatePath("/");
  redirectWithToast("/exams", {
    type: "success",
    title: "Prova excluída",
    description: `A prova "${deleted.title}" e seus conjuntos foram removidos.`,
  });
}
