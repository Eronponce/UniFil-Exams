"use server";

import { revalidatePath } from "next/cache";
import {
  createExam,
  createExamSet,
  createExamVersion,
  deactivateExam,
  reactivateExam,
  restoreExamVersion,
  saveExamVersion,
  type ExamVersionEditorInput,
} from "@/lib/db/exams";
import { getQuestion } from "@/lib/db/questions";
import { buildSets, normalizeExamDraftSeed, type QuestionInfo } from "@/lib/exam/randomize";
import { normalizeManualQuestionOrder } from "@/lib/exam/manual-order";
import { normalizeExamSelectionRequest, pickQuestionsForExam } from "@/lib/exam/select-questions";
import { redirectWithToast } from "@/lib/toast";
import { normalizeThematicAreas } from "@/lib/questions/thematic-areas";
import { normalizeExamQuestionLayouts } from "@/lib/exam/layout";
import { normalizeExamInstructions } from "@/lib/exam/instructions";
import {
  isValidQuestionImageScalePercent,
} from "@/lib/print/question-image-scale";

const SET_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const DEFAULT_VISUAL_DRAFT_SEED = "visual-default";

function readPositiveIntegerIds(formData: FormData, fieldName: string): number[] {
  const ids = new Set<number>();
  for (const value of formData.getAll(fieldName)) {
    if (typeof value !== "string") continue;
    const id = Number(value.trim());
    if (Number.isSafeInteger(id) && id > 0) ids.add(id);
  }
  return [...ids];
}

function readFormQuestionLayoutOverrides(formData: FormData): Record<number, "column" | "full"> {
  const overrides: Record<number, "column" | "full"> = {};
  for (const [name, value] of formData.entries()) {
    const match = /^layoutOverride-(\d+)$/.exec(name);
    if (!match || typeof value !== "string") continue;
    const questionId = Number(match[1]);
    if (!Number.isSafeInteger(questionId) || questionId <= 0) continue;
    if (value === "column" || value === "full") overrides[questionId] = value;
  }
  return overrides;
}

function readFormQuestionImageScaleOverrides(formData: FormData): {
  values: Record<number, number | null>;
  hasFields: boolean;
} {
  const values: Record<number, number | null> = {};
  let hasFields = false;
  for (const [name, value] of formData.entries()) {
    const match = /^imageScale-(\d+)$/.exec(name);
    if (!match) continue;
    const questionId = Number(match[1]);
    if (!Number.isSafeInteger(questionId) || questionId <= 0) continue;
    hasFields = true;
    const parsed = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
    values[questionId] = isValidQuestionImageScalePercent(parsed) ? parsed : null;
  }
  return { values, hasFields };
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
  const allowQuestionSplit = formData.get("allowQuestionSplit") === "1";
  const compactQuestionOrder = formData.get("compactQuestionOrder") === "1";
  const visualBuilder = formData.get("visualBuilder") === "1";
  const draftSeed = normalizeExamDraftSeed(formData.get("draftSeed")) ?? DEFAULT_VISUAL_DRAFT_SEED;
  const instructions = normalizeExamInstructions(formData.get("instructions"));
  const questionLayouts = normalizeExamQuestionLayouts({
    objetiva: formData.get("layoutObjetiva"),
    verdadeiro_falso: formData.get("layoutVF"),
    numerica: formData.get("layoutNumerica"),
    dissertativa: formData.get("layoutDissertativa"),
  });
  const allQuestionIds = readPositiveIntegerIds(formData, "questionIds");
  const fullWidthQuestionIds = readPositiveIntegerIds(formData, "fullWidthQuestionIds");
  const formQuestionLayoutOverrides = readFormQuestionLayoutOverrides(formData);
  const formQuestionImageScaleOverrides = readFormQuestionImageScaleOverrides(formData).values;
  const manualQuestionOrder = readPositiveIntegerIds(formData, "manualQuestionOrder");
  const thematicAreas = normalizeThematicAreas(formData.getAll("area").filter((value): value is string => typeof value === "string"));
  const qty = Math.min(Math.max(Number(quantitySetsRaw) || 1, 1), 8);
  const labels = SET_LETTERS.slice(0, qty);

  function buildErrorParams(error: string) {
    const params = new URLSearchParams({ error, title, institution, quantitySets: String(qty) });
    if (disciplineId) params.set("discipline", String(disciplineId));
    for (const area of thematicAreas) params.append("area", area);
    if (numObjetivasRaw) params.set("numObjetivas", numObjetivasRaw);
    if (numVFRaw) params.set("numVF", numVFRaw);
    if (numDissertativasRaw) params.set("numDissertativas", numDissertativasRaw);
    if (numNumericasRaw) params.set("numNumericas", numNumericasRaw);
    params.set("layoutObjetiva", questionLayouts.objetiva);
    params.set("layoutVF", questionLayouts.verdadeiro_falso);
    params.set("layoutNumerica", questionLayouts.numerica);
    params.set("layoutDissertativa", questionLayouts.dissertativa);
    params.set("allowQuestionSplit", allowQuestionSplit ? "1" : "0");
    params.set("compactQuestionOrder", compactQuestionOrder ? "1" : "0");
    if (visualBuilder) params.set("visualBuilder", "1");
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

  const loadedQuestions = allQuestionIds
    .map((id) => getQuestion(id))
    .filter((question) => question !== undefined);
  const questionInfos: QuestionInfo[] = loadedQuestions
    .map((q) => ({ id: q.id, correctIndex: q.correctIndex, questionType: q.questionType }));

  let selectedQuestionInfos: QuestionInfo[];
  let initialQuestionLayoutOverrides: Record<number, "column" | "full">;
  if (visualBuilder) {
    const auditedQuestionInfos = loadedQuestions
      .filter((question) => question.audited && !question.rejected && question.disciplineId === disciplineId)
      .map((question) => ({
        id: question.id,
        correctIndex: question.correctIndex,
        questionType: question.questionType,
        layout: formQuestionLayoutOverrides[question.id] ?? questionLayouts[question.questionType],
      }));
    selectedQuestionInfos = normalizeManualQuestionOrder(auditedQuestionInfos, manualQuestionOrder);
    // `readPositiveIntegerIds` already de-duplicates submitted fields. The
    // normalized valid/audited set must still match that submitted set exactly;
    // otherwise a stale or tampered visual draft must not become a partial exam.
    const submittedIds = new Set(allQuestionIds);
    const selectedIds = new Set(selectedQuestionInfos.map((question) => question.id));
    const exactVisualSelection = selectedQuestionInfos.length === allQuestionIds.length
      && selectedIds.size === submittedIds.size
      && [...submittedIds].every((questionId) => selectedIds.has(questionId));
    if (!exactVisualSelection) {
      const params = buildErrorParams("nenhuma-questao-auditada");
      redirectWithToast(`/exams?${params.toString()}`, {
        type: "error",
        title: "Seleção visual desatualizada",
        description: "Uma ou mais questões selecionadas não existem mais, não estão auditadas ou pertencem a outra disciplina. Recarregue o banco e tente novamente.",
      });
    }
    initialQuestionLayoutOverrides = Object.fromEntries(
      selectedQuestionInfos
        .filter((question) => formQuestionLayoutOverrides[question.id] !== undefined)
        .map((question) => [question.id, formQuestionLayoutOverrides[question.id]!]),
    );
  } else {
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

    const selectedQuestionIds = new Set(selectedQuestionInfos.map((question) => question.id));
    initialQuestionLayoutOverrides = Object.fromEntries(
      fullWidthQuestionIds
        .filter((questionId) => selectedQuestionIds.has(questionId))
        .map((questionId) => [questionId, "full" as const]),
    );
  }

  if (selectedQuestionInfos.length === 0) {
    const params = buildErrorParams("nenhuma-questao");
    redirectWithToast(`/exams?${params.toString()}`, {
      type: "error",
      title: "Nenhuma questão selecionada",
      description: "As quantidades informadas geraram uma prova vazia.",
    });
  }

  const questionInfosForSets = selectedQuestionInfos.map((question) => ({
    ...question,
    layout: initialQuestionLayoutOverrides[question.id] ?? question.layout ?? questionLayouts[question.questionType],
  }));
  const sets = buildSets(
    questionInfosForSets,
    labels,
    visualBuilder
      ? { manualQuestionOrder: selectedQuestionInfos.map((question) => question.id), seed: draftSeed }
      : { compactLayoutOrder: compactQuestionOrder },
  );
  if (sets.some((set) =>
    set.questionOrder.length !== selectedQuestionInfos.length
    || set.shuffledOptions.length !== selectedQuestionInfos.length
    || set.correctShuffledIndices.length !== selectedQuestionInfos.length,
  )) {
    const params = buildErrorParams("conjunto-invalido");
    redirectWithToast(`/exams?${params.toString()}`, {
      type: "error",
      title: "Não foi possível montar os sets",
      description: "A distribuição das questões foi invalidada antes da criação da prova.",
    });
  }

  const exam = createExam({
    disciplineId,
    title,
    institution,
    instructions,
    allowQuestionSplit,
    questionIds: selectedQuestionInfos.map((q) => q.id),
    questionLayouts,
    questionLayoutOverrides: initialQuestionLayoutOverrides,
    questionImageScaleOverrides: formQuestionImageScaleOverrides,
  });

  for (const s of sets) {
    createExamSet(exam.id, {
      label: s.label,
      questionOrder: s.questionOrder,
      shuffledOptions: s.shuffledOptions,
      correctShuffledIndices: s.correctShuffledIndices,
    });
  }

  createExamVersion(exam.id, "Versão inicial");

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
      description: "Não foi possível identificar a prova para inativação.",
    });
  }

  const deactivated = deactivateExam(examId);
  if (!deactivated) {
    redirectWithToast("/exams", {
      type: "error",
      title: "Prova não encontrada",
      description: "A prova não existe mais.",
    });
  }

  revalidatePath("/exams");
  revalidatePath("/exports");
  revalidatePath("/");
  redirectWithToast("/exams", {
    type: "success",
    title: "Prova inativada",
    description: `A prova "${deactivated.title}" foi ocultada das provas ativas. Histórico, sets e arquivos foram preservados.`,
  });
}

export async function reactivateExamAction(formData: FormData) {
  const examId = Number(formData.get("id"));
  if (!Number.isInteger(examId) || examId <= 0) {
    redirectWithToast("/exams", {
      type: "error",
      title: "Prova inválida",
      description: "Não foi possível identificar a prova para reativação.",
    });
  }

  const reactivated = reactivateExam(examId);
  if (!reactivated) {
    redirectWithToast("/exams", {
      type: "error",
      title: "Prova não encontrada",
      description: "A prova não existe mais.",
    });
  }

  revalidatePath("/exams");
  revalidatePath("/exports");
  revalidatePath("/");
  redirectWithToast("/exams?status=ativas", {
    type: "success",
    title: "Prova reativada",
    description: `A prova "${reactivated.title}" voltou para a lista de provas ativas.`,
  });
}

function readEditorInput(formData: FormData): { examId: number; input: ExamVersionEditorInput } {
  const examId = Number(formData.get("examId"));
  const formText = (value: FormDataEntryValue | null): string => typeof value === "string" ? value : "";
  const questionLayoutOverrides: Record<number, "column" | "full" | null> = {};
  const imageScaleFields = readFormQuestionImageScaleOverrides(formData);
  for (const [name, value] of formData.entries()) {
    const match = /^layoutOverride-(\d+)$/.exec(name);
    if (!match) continue;
    const normalized = typeof value === "string" ? value : "";
    questionLayoutOverrides[Number(match[1])] = normalized === "column" || normalized === "full" ? normalized : null;
  }
  return {
    examId,
    input: {
      title: formText(formData.get("title")).trim(),
      institution: formText(formData.get("institution")).trim(),
      instructions: normalizeExamInstructions(formData.get("instructions")),
      allowQuestionSplit: formData.get("allowQuestionSplit") === "1",
      questionLayouts: {
        objetiva: formText(formData.get("layoutObjetiva")),
        verdadeiro_falso: formText(formData.get("layoutVF")),
        numerica: formText(formData.get("layoutNumerica")),
        dissertativa: formText(formData.get("layoutDissertativa")),
      },
      questionLayoutOverrides,
      questionImageScaleOverrides: imageScaleFields.hasFields ? imageScaleFields.values : undefined,
      changeNote: formText(formData.get("changeNote")).trim(),
    },
  };
}

export async function saveExamVersionAction(formData: FormData) {
  const { examId, input } = readEditorInput(formData);
  if (!Number.isInteger(examId) || examId <= 0) {
    redirectWithToast("/exams", {
      type: "error",
      title: "Prova inválida",
      description: "Não foi possível identificar a prova para edição.",
    });
  }

  try {
    const version = saveExamVersion(examId, input);
    revalidatePath(`/exams/${examId}/edit`);
    revalidatePath("/exams");
    revalidatePath("/exports");
    revalidatePath(`/print/exam/${examId}`);
    redirectWithToast(`/exams/${examId}/edit?version=${version.versionNumber}`, {
      type: "success",
      title: "Nova versão salva",
      description: `Versão ${version.versionNumber} criada sem alterar o histórico anterior.`,
    });
  } catch (error) {
    redirectWithToast(`/exams/${examId}/edit`, {
      type: "error",
      title: "Não foi possível salvar",
      description: error instanceof Error ? error.message : "Erro inesperado ao salvar a versão.",
    });
  }
}

export async function restoreExamVersionAction(formData: FormData) {
  const examId = Number(formData.get("examId"));
  const versionNumber = Number(formData.get("versionNumber"));
  if (!Number.isInteger(examId) || examId <= 0 || !Number.isInteger(versionNumber) || versionNumber <= 0) {
    redirectWithToast("/exams", {
      type: "error",
      title: "Versão inválida",
      description: "Não foi possível identificar a versão para restauração.",
    });
  }

  try {
    const version = restoreExamVersion(examId, versionNumber);
    revalidatePath(`/exams/${examId}/edit`);
    revalidatePath("/exams");
    revalidatePath("/exports");
    revalidatePath(`/print/exam/${examId}`);
    redirectWithToast(`/exams/${examId}/edit?version=${version.versionNumber}`, {
      type: "success",
      title: "Versão restaurada",
      description: `A versão ${versionNumber} foi restaurada como a nova versão ${version.versionNumber}.`,
    });
  } catch (error) {
    redirectWithToast(`/exams/${examId}/edit`, {
      type: "error",
      title: "Não foi possível restaurar",
      description: error instanceof Error ? error.message : "Erro inesperado ao restaurar a versão.",
    });
  }
}
