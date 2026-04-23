"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { createQuestion, updateQuestion, auditQuestion, deleteQuestion } from "@/lib/db/questions";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "questions");

async function saveImage(file: File): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/questions/${filename}`;
}

export async function createQuestionAction(formData: FormData) {
  const disciplineId = Number(formData.get("disciplineId"));
  const statement = (formData.get("statement") as string | null)?.trim() ?? "";
  const options = [0, 1, 2, 3, 4].map((i) => (formData.get(`option${i}`) as string | null)?.trim() ?? "") as [string, string, string, string, string];
  const correctIndex = Number(formData.get("correctIndex"));
  const difficulty = (formData.get("difficulty") as string | null) ?? "medium";
  const source = (formData.get("source") as string | null) ?? "manual";
  const thematicArea = (formData.get("thematicArea") as string | null)?.trim() || undefined;
  const explanation = (formData.get("explanation") as string | null)?.trim() || "";

  if (!disciplineId || !statement || options.some((o) => !o)) redirect("/questions/new?error=campos-obrigatorios");

  let imagePath: string | undefined;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) imagePath = await saveImage(imageFile);

  createQuestion({ disciplineId, statement, options, correctIndex, difficulty: difficulty as "easy" | "medium" | "hard", source: source as "manual" | "ai", imagePath, thematicArea, explanation });
  revalidatePath("/questions");
  revalidatePath("/");
  redirect("/questions");
}

export async function updateQuestionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const statement = (formData.get("statement") as string | null)?.trim();
  const options = [0, 1, 2, 3, 4].map((i) => (formData.get(`option${i}`) as string | null)?.trim() ?? "") as [string, string, string, string, string];
  const correctIndex = Number(formData.get("correctIndex"));
  const difficulty = (formData.get("difficulty") as string | null) as "easy" | "medium" | "hard" | undefined;
  const thematicArea = (formData.get("thematicArea") as string | null)?.trim() || "";
  const explanation = (formData.get("explanation") as string | null)?.trim() ?? "";

  let imagePath: string | undefined;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) imagePath = await saveImage(imageFile);

  updateQuestion(id, { statement, options, correctIndex, difficulty, thematicArea, explanation, ...(imagePath ? { imagePath } : {}) });
  revalidatePath("/questions");
  revalidatePath(`/questions/${id}`);
  revalidatePath("/audit");
  revalidatePath("/");
  redirect(`/questions/${id}`);
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
  redirect(back);
}

export async function deleteQuestionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const back = (formData.get("back") as string | null) ?? "/questions";
  deleteQuestion(id);
  revalidatePath("/questions");
  revalidatePath("/audit");
  revalidatePath("/");
  redirect(back);
}

export async function batchSaveQuestionsAction(
  questions: { statement: string; options: [string, string, string, string, string]; correctIndex: number; difficulty?: "easy" | "medium" | "hard"; thematicArea?: string; explanation?: string }[],
  disciplineId: number
): Promise<{ count: number; error?: string }> {
  if (!questions.length || !disciplineId) return { count: 0, error: "Dados inválidos." };

  let count = 0;
  for (const q of questions) {
    createQuestion({ disciplineId, statement: q.statement, options: q.options, correctIndex: q.correctIndex, difficulty: q.difficulty ?? "medium", source: "ai", thematicArea: q.thematicArea, explanation: q.explanation ?? "" });
    count++;
  }

  revalidatePath("/questions");
  revalidatePath("/audit");
  revalidatePath("/");
  return { count };
}
