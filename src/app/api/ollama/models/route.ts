import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return NextResponse.json({ models: [], error: `Ollama ${res.status}` });
    const data = (await res.json()) as { models?: { name: string }[] };
    const models = (data.models ?? []).map((m) => m.name).filter(Boolean);
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [], error: "Ollama offline" });
  }
}
