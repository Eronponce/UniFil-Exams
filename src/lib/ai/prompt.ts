import type { QuestionType } from "@/types";
import { buildSingleQuestionPrompt } from "./prompt-templates";

export interface GeneratedQuestion {
  questionType: QuestionType;
  statement: string;
  options: string[];
  correctIndex: number;
  answerLines: number;
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
  thematicArea?: string;
}

function parseDifficulty(value: unknown): GeneratedQuestion["difficulty"] {
  return value === "easy" || value === "medium" || value === "hard" ? value : undefined;
}

function parseThematicArea(parsed: Record<string, unknown>): string | undefined {
  if (typeof parsed.thematicArea === "string" && parsed.thematicArea) return parsed.thematicArea;
  if (typeof parsed.thematic_area === "string" && parsed.thematic_area) return parsed.thematic_area;
  return undefined;
}

export function buildPrompt(discipline: string, topic: string): string {
  return buildSingleQuestionPrompt(discipline, topic, "objetiva");
}

export function parseResponse(raw: string): GeneratedQuestion {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta nao contem JSON valido");
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  if (
    typeof parsed.statement !== "string" ||
    !Array.isArray(parsed.options) ||
    parsed.options.length !== 5 ||
    typeof parsed.correctIndex !== "number"
  ) {
    throw new Error("Estrutura do JSON invalida");
  }
  const stripPrefix = (s: string) => s.replace(/^[A-Ea-e1-5][\)\.\-]\s*/, "").trim();
  return {
    questionType: "objetiva",
    statement: parsed.statement,
    options: (parsed.options as string[]).map(stripPrefix),
    correctIndex: parsed.correctIndex,
    answerLines: 0,
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    difficulty: parseDifficulty(parsed.difficulty),
    thematicArea: parseThematicArea(parsed),
  };
}

export function buildPromptVF(discipline: string, topic: string): string {
  return buildSingleQuestionPrompt(discipline, topic, "verdadeiro_falso");
}

export function parseResponseVF(raw: string): GeneratedQuestion {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta nao contem JSON valido");
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  if (typeof parsed.statement !== "string") throw new Error("Estrutura do JSON invalida");
  const isTrue =
    typeof parsed.correctIndex === "number"
      ? parsed.correctIndex === 0
      : typeof parsed.isTrue === "boolean"
      ? parsed.isTrue
      : Boolean(parsed.isTrue);
  return {
    questionType: "verdadeiro_falso",
    statement: parsed.statement,
    options: ["Verdadeiro", "Falso"],
    correctIndex: isTrue ? 0 : 1,
    answerLines: 0,
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    difficulty: parseDifficulty(parsed.difficulty),
    thematicArea: parseThematicArea(parsed),
  };
}

export function buildPromptDissertativa(discipline: string, topic: string): string {
  return buildSingleQuestionPrompt(discipline, topic, "dissertativa");
}

export function parseResponseDissertativa(raw: string): GeneratedQuestion {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta nao contem JSON valido");
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  if (typeof parsed.statement !== "string") throw new Error("Estrutura do JSON invalida");
  const lines =
    typeof parsed.answerLines === "number" && Number.isInteger(parsed.answerLines)
      ? Math.min(Math.max(parsed.answerLines, 1), 20)
      : 6;
  return {
    questionType: "dissertativa",
    statement: parsed.statement,
    options: [],
    correctIndex: 0,
    answerLines: lines,
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    difficulty: parseDifficulty(parsed.difficulty),
    thematicArea: parseThematicArea(parsed),
  };
}
