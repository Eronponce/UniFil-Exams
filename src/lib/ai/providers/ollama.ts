import { buildPrompt, parseResponse, type GeneratedQuestion } from "../prompt";

export async function callOllama(prompt: string, numPredict = 1024, model?: string): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  model = model ?? process.env.OLLAMA_MODEL ?? "qwen2.5:latest";

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, format: "json", stream: false, options: { num_predict: numPredict } }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Não foi possível conectar ao Ollama em ${baseUrl}. Verifique se o servidor está rodando (execute "ollama serve"). Detalhe: ${msg}`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404) {
      throw new Error(`Modelo "${model}" não encontrado no Ollama. Execute "ollama pull ${model}" ou ajuste OLLAMA_MODEL em .env.local. Modelos disponíveis: ollama list`);
    }
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { response: string };
  return data.response;
}

export async function generateWithOllama(discipline: string, topic: string, model?: string): Promise<GeneratedQuestion> {
  return parseResponse(await callOllama(buildPrompt(discipline, topic), 1024, model));
}
