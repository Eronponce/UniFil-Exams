import Anthropic from "@anthropic-ai/sdk";
import { buildPrompt, parseResponse, type GeneratedQuestion } from "../prompt";

export async function callClaude(prompt: string, maxTokens = 1024): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY não configurada em .env.local");

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Resposta Claude sem conteúdo de texto");
  return content.text;
}

export async function generateWithClaude(discipline: string, topic: string): Promise<GeneratedQuestion> {
  return parseResponse(await callClaude(buildPrompt(discipline, topic)));
}
