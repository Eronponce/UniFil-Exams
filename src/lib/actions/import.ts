"use server";

import { QuestionExportFileSchema, parseCsvQuestions } from "@/lib/importexport/types";
import { batchSaveQuestionsAction } from "./questions";

export async function importQuestionsFromJsonAction(
  jsonText: string,
  disciplineId: number
): Promise<{ count: number; errors: string[] }> {
  let parsed;
  try {
    parsed = QuestionExportFileSchema.parse(JSON.parse(jsonText));
  } catch (e) {
    return { count: 0, errors: [e instanceof Error ? e.message : "JSON inválido."] };
  }

  const result = await batchSaveQuestionsAction(
    parsed.questions.map((q) => ({ ...q, thematicArea: q.thematicArea ?? undefined })),
    disciplineId,
  );
  return { count: result.count, errors: result.error ? [result.error] : [] };
}

export async function importQuestionsFromCsvAction(
  csvText: string,
  disciplineId: number
): Promise<{ count: number; errors: string[] }> {
  let questions;
  try {
    questions = parseCsvQuestions(csvText);
  } catch (e) {
    return { count: 0, errors: [e instanceof Error ? e.message : "CSV inválido."] };
  }

  if (!questions.length) return { count: 0, errors: ["Nenhuma questão encontrada no arquivo."] };

  const result = await batchSaveQuestionsAction(
    questions.map((q) => ({ ...q, thematicArea: q.thematicArea ?? undefined })),
    disciplineId,
  );
  return { count: result.count, errors: result.error ? [result.error] : [] };
}
