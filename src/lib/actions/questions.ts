"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { QuestionType } from "@/types";
import {
  createQuestion,
  updateQuestion,
  auditQuestion,
  rejectQuestion,
  deleteQuestion,
  deleteQuestions,
  getQuestion,
  getQuestionNavigation,
  updateQuestionsThematicArea,
  updateQuestionsStatementAndThematicArea,
} from "@/lib/db/questions";
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
  let correctAnswer = "";

  if (questionType === "objetiva") {
    options = [0, 1, 2, 3, 4].map((i) => (formData.get(`option${i}`) as string | null)?.trim() ?? "");
    if (options.some((o) => !o)) {
      return { error: "Preencha as cinco alternativas da questão objetiva." };
    }
    correctIndex = Number(formData.get("correctIndex"));
  } else if (questionType === "verdadeiro_falso") {
    options = ["Verdadeiro", "Falso"];
    correctIndex = Number(formData.get("correctIndex"));
  } else if (questionType === "numerica") {
    const raw = (formData.get("correctAnswer") as string | null)?.trim() ?? "";
    if (!raw || !/^[\d\s,]+$/.test(raw)) {
      return { error: "Resposta numérica inválida. Use somente dígitos, espaços ou vírgulas." };
    }
    correctAnswer = raw;
    options = [];
    correctIndex = 0;
  } else {
    // dissertativa
    options = [];
    correctIndex = 0;
    answerLines = Number(formData.get("answerLines") ?? 3);
  }

  let imagePath: string | undefined;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) imagePath = await saveImage(imageFile);

  createQuestion({ disciplineId, statement, options, correctIndex, difficulty: difficulty as "easy" | "medium" | "hard", source: source as "manual" | "ai", imagePath, thematicArea, explanation, questionType, answerLines, correctAnswer });
  revalidatePath("/questions");
  revalidatePath("/audit");
  revalidatePath("/exams");
  revalidatePath("/exports");
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
  const existing = getQuestion(id);
  if (!existing) return { error: "Questão não encontrada." };
  const statement = (formData.get("statement") as string | null)?.trim();
  const questionType = ((formData.get("questionType") as string | null) ?? "objetiva") as QuestionType;
  const difficulty = (formData.get("difficulty") as string | null) as "easy" | "medium" | "hard" | undefined;
  const thematicArea = (formData.get("thematicArea") as string | null)?.trim() || "";
  const explanation = (formData.get("explanation") as string | null)?.trim() ?? "";

  let options: string[];
  let correctIndex: number;
  let answerLines = 0;
  let correctAnswer = "";

  if (questionType === "objetiva") {
    options = [0, 1, 2, 3, 4].map((i) => (formData.get(`option${i}`) as string | null)?.trim() ?? "");
    correctIndex = Number(formData.get("correctIndex"));
  } else if (questionType === "verdadeiro_falso") {
    options = ["Verdadeiro", "Falso"];
    correctIndex = Number(formData.get("correctIndex"));
  } else if (questionType === "numerica") {
    const raw = (formData.get("correctAnswer") as string | null)?.trim() ?? "";
    correctAnswer = raw;
    options = [];
    correctIndex = 0;
  } else {
    options = [];
    correctIndex = 0;
    answerLines = Number(formData.get("answerLines") ?? 3);
  }

  let imagePath: string | undefined;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) imagePath = await saveImage(imageFile);

  updateQuestion(id, { statement, options, correctIndex, difficulty, thematicArea, explanation, questionType, answerLines, correctAnswer, ...(imagePath ? { imagePath } : {}) });
  revalidatePath("/questions");
  revalidatePath(`/questions/${id}`);
  revalidatePath("/audit");
  revalidatePath("/exams");
  revalidatePath("/exports");
  revalidatePath("/");
  const navigation = formData.get("navigation");
  const neighbor = navigation === "previous" || navigation === "next"
    ? getQuestionNavigation(id, existing.disciplineId)[navigation === "previous" ? "previousId" : "nextId"]
    : undefined;
  redirectWithToast(neighbor ? `/questions/${neighbor}/edit` : `/questions/${id}`, {
    type: "success",
    title: "Questão atualizada",
    description: "As alterações foram salvas.",
  });
}

export interface BatchQuestionEditState {
  ok?: boolean;
  count?: number;
  error?: string;
}

function areStrings(values: FormDataEntryValue[]): values is string[] {
  return values.every((value) => typeof value === "string");
}

export async function batchUpdateQuestionsAction(
  _prev: BatchQuestionEditState | undefined,
  formData: FormData,
): Promise<BatchQuestionEditState> {
  const ids = formData.getAll("id");
  const statements = formData.getAll("statement");
  const thematicAreas = formData.getAll("thematicArea");
  if (ids.length === 0 || ids.length !== statements.length || ids.length !== thematicAreas.length) {
    return { error: "Dados da edição em lote inválidos." };
  }
  if (!areStrings(ids) || !areStrings(statements) || !areStrings(thematicAreas)) {
    return { error: "Dados da edição em lote inválidos." };
  }

  try {
    const count = updateQuestionsStatementAndThematicArea(ids.map((id, index) => ({
      id: Number(id),
      statement: statements[index],
      thematicArea: thematicAreas[index],
    })));
    revalidatePath("/questions");
    revalidatePath("/audit");
    revalidatePath("/exams");
    revalidatePath("/exports");
    revalidatePath("/");
    return { ok: true, count };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível editar as questões." };
  }
}

export async function batchSetQuestionsThematicAreaAction(
  _prev: BatchQuestionEditState | undefined,
  formData: FormData,
): Promise<BatchQuestionEditState> {
  const ids = formData.getAll("id");
  const thematicArea = formData.get("thematicArea");
  if (ids.length === 0 || !areStrings(ids) || typeof thematicArea !== "string") {
    return { error: "Dados da edição em lote inválidos." };
  }

  try {
    const count = updateQuestionsThematicArea(ids.map(Number), thematicArea);
    revalidatePath("/questions");
    revalidatePath("/audit");
    revalidatePath("/exams");
    revalidatePath("/exports");
    revalidatePath("/");
    return { ok: true, count };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível alterar a área temática." };
  }
}

export async function auditQuestionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const value = formData.get("audited") === "true";
  const back = (formData.get("back") as string | null) ?? `/questions/${id}`;
  auditQuestion(id, value);
  revalidatePath("/questions");
  revalidatePath(`/questions/${id}`);
  revalidatePath("/audit");
  revalidatePath("/exams");
  revalidatePath("/exports");
  revalidatePath("/");
  redirectWithToast(back, {
    type: "success",
    title: value ? "Questão auditada" : "Auditoria removida",
    description: value ? "A questão foi marcada como auditada." : "A questão voltou para a fila de revisão.",
  });
}

export async function setQuestionAuditedAction(id: number, audited: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "Questão inválida." };
  auditQuestion(id, audited);
  revalidatePath("/questions");
  revalidatePath(`/questions/${id}`);
  revalidatePath("/audit");
  revalidatePath("/exams");
  revalidatePath("/exports");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteQuestionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const back = (formData.get("back") as string | null) ?? "/questions";
  deleteQuestion(id);
  revalidatePath("/questions");
  revalidatePath("/audit");
  revalidatePath("/exams");
  revalidatePath("/exports");
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
  revalidatePath("/exams");
  revalidatePath("/exports");
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
  revalidatePath("/exams");
  revalidatePath("/exports");
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
    correctAnswer?: string;
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
      correctAnswer: q.correctAnswer ?? "",
    });
    count++;
  }

  revalidatePath("/questions");
  revalidatePath("/audit");
  revalidatePath("/exams");
  revalidatePath("/exports");
  revalidatePath("/");
  return { count };
}
