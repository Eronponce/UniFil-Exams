"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { QuestionType } from "@/types";
import { createQuestion, updateQuestion, auditQuestion, rejectQuestion, deleteQuestion, deleteQuestions } from "@/lib/db/questions";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { redirectWithToast } from "@/lib/toast";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "questions");

async function saveImage(file: File): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/questions/${filename}`;
}

export interface QuestionFormState {
  error?: string;
}

export async function createQuestionAction(
  _prev: QuestionFormState | undefined,
  formData: FormData
): Promise<QuestionFormState | undefined> {
  const disciplineId = Number(formData.get("disciplineId"));
  const statement = (formData.get("statement") as string | null)?.trim() ?? "";
  const questionType = ((formData.get("questionType") as string | null) ?? "objetiva") as QuestionType;
  const difficulty = (formData.get("difficulty") as string | null) ?? "medium";
  const source = (formData.get("source") as string | null) ?? "manual";
  const thematicArea = (formData.get("thematicArea") as string | null)?.trim() || undefined;
  const explanation = (formData.get("explanation") as string | null)?.trim() || "";

  if (!disciplineId || !statement) {
    return { error: "Disciplina e enunciado são obrigatórios." };
  }

  let options: string[];
  let correctIndex: number;
  let answerLines = 0;

  if (questionType === "objetiva") {
    options = [0, 1, 2, 3, 4].map((i) => (formData.get(`option${i}`) as string | null)?.trim() ?? "");
    if (options.some((o) => !o)) {
      return { error: "Preencha as cinco alternativas da questão objetiva." };
    }
    correctIndex = Number(formData.get("correctIndex"));
  } else if (questionType === "verdadeiro_falso") {
    options = ["Verdadeiro", "Falso"];
    correctIndex = Number(formData.get("correctIndex"));
  } else {
    // dissertativa
    options = [];
    correctIndex = 0;
    answerLines = Number(formData.get("answerLines") ?? 3);
  }

  let imagePath: string | undefined;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) imagePath = await saveImage(imageFile);

  createQuestion({ disciplineId, statement, options, correctIndex, difficulty: difficulty as "easy" | "medium" | "hard", source: source as "manual" | "ai", imagePath, thematicArea, explanation, questionType, answerLines });
  revalidatePath("/questions");
  revalidatePath("/audit");
  revalidatePath("/");
  redirectWithToast("/questions", {
    type: "success",
    title: source === "ai" ? "Questão gerada salva" : "Questão criada",
    description: source === "ai" ? "A questão gerada pela IA entrou no banco." : "A nova questão foi adicionada ao banco.",
  });
}

export async function updateQuestionAction(
  _prev: QuestionFormState | undefined,
  formData: FormData
): Promise<QuestionFormState | undefined> {
  const id = Number(formData.get("id"));
  const statement = (formData.get("statement") as string | null)?.trim();
  const questionType = ((formData.get("questionType") as string | null) ?? "objetiva") as QuestionType;
  const difficulty = (formData.get("difficulty") as string | null) as "easy" | "medium" | "hard" | undefined;
  const thematicArea = (formData.get("thematicArea") as string | null)?.trim() || "";
  const explanation = (formData.get("explanation") as string | null)?.trim() ?? "";

  let options: string[];
  let correctIndex: number;
  let answerLines = 0;

  if (questionType === "objetiva") {
    options = [0, 1, 2, 3, 4].map((i) => (formData.get(`option${i}`) as string | null)?.trim() ?? "");
    correctIndex = Number(formData.get("correctIndex"));
  } else if (questionType === "verdadeiro_falso") {
    options = ["Verdadeiro", "Falso"];
    correctIndex = Number(formData.get("correctIndex"));
  } else {
    options = [];
    correctIndex = 0;
    answerLines = Number(formData.get("answerLines") ?? 3);
  }

  let imagePath: string | undefined;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) imagePath = await saveImage(imageFile);

  updateQuestion(id, { statement, options, correctIndex, difficulty, thematicArea, explanation, questionType, answerLines, ...(imagePath ? { imagePath } : {}) });
  revalidatePath("/questions");
  revalidatePath(`/questions/${id}`);
  revalidatePath("/audit");
  revalidatePath("/");
  redirectWithToast(`/questions/${id}`, {
    type: "success",
    title: "Questão atualizada",
    description: "As alterações foram salvas.",
  });
}

export async function auditQuestionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const value = formData.get("audited") === "true";
  const back = (formData.get("back") as string | null) ?? `/questions/${id}`;
  auditQuestion(id, value);
  revalidatePath("/questions");
  revalidatePath(`/questions/${id}`);
  revalidatePath("/audit");
  revalidatePath("/");
  redirectWithToast(back, {
    type: "success",
    title: value ? "Questão auditada" : "Auditoria removida",
    description: value ? "A questão foi marcada como auditada." : "A questão voltou para a fila de revisão.",
  });
}

export async function deleteQuestionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const back = (formData.get("back") as string | null) ?? "/questions";
  deleteQuestion(id);
  revalidatePath("/questions");
  revalidatePath("/audit");
  revalidatePath("/");
  redirectWithToast(back, {
    type: "success",
    title: "Questão excluída",
    description: "A questão foi removida do sistema.",
  });
}

export async function rejectQuestionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const value = formData.get("value") !== "0";
  rejectQuestion(id, value);
  revalidatePath("/audit");
  revalidatePath("/questions");
  revalidatePath("/");
}

export async function deleteAllRejectedAction(formData: FormData) {
  const disciplineId = formData.get("disciplineId") ? Number(formData.get("disciplineId")) : undefined;
  const rejected = listQuestionsFiltered({ rejected: true, disciplineId });
  const ids = rejected.map((q) => q.id);
  if (ids.length) deleteQuestions(ids);
  revalidatePath("/audit");
  revalidatePath("/questions");
  revalidatePath("/");
  redirectWithToast("/audit", {
    type: "success",
    title: "Recusadas excluídas",
    description: `${ids.length} questão(ões) removida(s).`,
  });
}

export async function deleteManyQuestionsAction(formData: FormData) {
  const ids = formData.getAll("ids").map(Number).filter(Boolean);
  if (ids.length === 0) return;
  deleteQuestions(ids);
  revalidatePath("/questions");
  revalidatePath("/audit");
  revalidatePath("/");
  redirectWithToast("/questions", {
    type: "success",
    title: "Questões excluídas",
    description: `${ids.length} questão(ões) removida(s).`,
  });
}

export async function batchSaveQuestionsAction(
  questions: {
    statement: string;
    options: string[];
    correctIndex: number;
    difficulty?: "easy" | "medium" | "hard";
    thematicArea?: string;
    explanation?: string;
    questionType?: QuestionType;
    answerLines?: number;
  }[],
  disciplineId: number
): Promise<{ count: number; error?: string }> {
  if (!questions.length || !disciplineId) return { count: 0, error: "Dados inválidos." };

  let count = 0;
  for (const q of questions) {
    createQuestion({
      disciplineId,
      statement: q.statement,
      options: q.options,
      correctIndex: q.correctIndex,
      difficulty: q.difficulty ?? "medium",
      source: "ai",
      thematicArea: q.thematicArea,
      explanation: q.explanation ?? "",
      questionType: q.questionType ?? "objetiva",
      answerLines: q.answerLines ?? 0,
    });
    count++;
  }

  revalidatePath("/questions");
  revalidatePath("/audit");
  revalidatePath("/");
  return { count };
}
