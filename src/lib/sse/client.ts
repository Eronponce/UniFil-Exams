export interface SseEnvelope<T = unknown> {
  type: string;
  payload: T;
}

export async function consumeSseResponse(
  response: Response,
  onEvent: (event: SseEnvelope) => void,
): Promise<void> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (!response.body) throw new Error("Resposta sem corpo para streaming.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      let event = "message";
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }

      if (!dataLines.length) continue;
      const raw = dataLines.join("\n");
      const payload = JSON.parse(raw) as unknown;
      onEvent({ type: event, payload });
    }
  }
}
