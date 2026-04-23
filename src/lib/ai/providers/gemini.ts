import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildPrompt, parseResponse, type GeneratedQuestion } from "../prompt";

export async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada em .env.local");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateWithGemini(discipline: string, topic: string): Promise<GeneratedQuestion> {
  return parseResponse(await callGemini(buildPrompt(discipline, topic)));
}
