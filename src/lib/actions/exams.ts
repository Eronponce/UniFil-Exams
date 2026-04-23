"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createExam, createExamSet } from "@/lib/db/exams";
import { getQuestion } from "@/lib/db/questions";
import { buildSets } from "@/lib/exam/randomize";

const SET_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function fisherYatesSample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export async function createExamAction(formData: FormData) {
  const disciplineId = Number(formData.get("disciplineId"));
  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const institution = (formData.get("institution") as string | null)?.trim() || "UniFil - Centro Universitário Filadélfia";
  const allQuestionIds = (formData.getAll("questionIds") as string[]).map(Number).filter(Boolean);
  const numQuestions = Number(formData.get("numQuestions")) || 0;
  // Sample numQuestions from pool if specified and smaller than pool
  const questionIds = numQuestions > 0 && numQuestions < allQuestionIds.length
    ? fisherYatesSample(allQuestionIds, numQuestions)
    : allQuestionIds;
  const qty = Math.min(Math.max(Number(formData.get("quantitySets")) || 1, 1), 8);
  const labels = SET_LETTERS.slice(0, qty);

  if (!disciplineId || !title || questionIds.length === 0) {
    redirect("/exams?error=campos-obrigatorios");
  }

  const correctIndices: Record<number, number> = {};
  for (const qid of questionIds) {
    const q = getQuestion(qid);
    if (q) correctIndices[qid] = q.correctIndex;
  }

  const exam = createExam({ disciplineId, title, institution, questionIds });
  const sets = buildSets(questionIds, correctIndices, labels);

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
  redirect(`/exports?exam=${exam.id}&new=1`);
}
