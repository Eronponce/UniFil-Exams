import type { AITrace } from "@/lib/ai/trace";
import type { GenerateStreamRequest } from "@/lib/ai/stream";
import { makeStatusEvent } from "@/lib/ai/stream";
import { buildPrompt, buildPromptDissertativa, buildPromptVF, parseResponse, parseResponseDissertativa, parseResponseVF } from "@/lib/ai/prompt";
import { callClaude } from "@/lib/ai/providers/claude";
import { callGemini } from "@/lib/ai/providers/gemini";
import { callOllama } from "@/lib/ai/providers/ollama";
import { getDiscipline } from "@/lib/db/disciplines";
import type { GeneratedQuestion } from "@/lib/ai/prompt";

const encoder = new TextEncoder();

function emit(controller: ReadableStreamDefaultController<Uint8Array>, type: string, payload: unknown) {
  controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`));
}

function buildTrace(request: GenerateStreamRequest, trace: AITrace["rounds"], succeededRound: number | null): AITrace {
  return {
    provider: request.provider,
    model: request.provider === "ollama" ? (request.ollamaModel ?? process.env.OLLAMA_MODEL ?? "qwen2.5:latest") : undefined,
    questionType: request.questionType,
    rounds: trace,
    succeededRound,
  };
}

function getPromptTools(questionType: GenerateStreamRequest["questionType"]) {
  if (questionType === "verdadeiro_falso") return { promptBuilder: buildPromptVF, parser: parseResponseVF };
  if (questionType === "dissertativa") return { promptBuilder: buildPromptDissertativa, parser: parseResponseDissertativa };
  return { promptBuilder: buildPrompt, parser: parseResponse };
}

async function callProvider(request: GenerateStreamRequest, prompt: string): Promise<string> {
  if (request.provider === "claude") return callClaude(prompt);
  if (request.provider === "gemini") return callGemini(prompt);
  return callOllama(prompt, 1024, request.ollamaModel);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as GenerateStreamRequest | null;
  if (!body) return new Response("Payload inválido.", { status: 400 });

  if (!body.disciplineId || !body.topic?.trim()) {
    return new Response("Disciplina e tema são obrigatórios.", { status: 400 });
  }

  const discipline = getDiscipline(body.disciplineId);
  if (!discipline) return new Response("Disciplina não encontrada.", { status: 404 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const { promptBuilder, parser } = getPromptTools(body.questionType);
      const rounds: AITrace["rounds"] = [];

      try {
        emit(controller, "status", makeStatusEvent("validating", "Parâmetros validados"));
        emit(controller, "status", makeStatusEvent("prompt", "Montando prompt da geração"));

        const prompt = promptBuilder(discipline.name, body.topic.trim());
        rounds.push({ round: 1, prompt, succeeded: false });
        emit(controller, "trace", buildTrace(body, [...rounds], null));
        emit(controller, "status", makeStatusEvent("provider", "Enviando prompt ao provedor IA", {
          detail: `${body.provider}${body.provider === "ollama" && body.ollamaModel ? ` · ${body.ollamaModel}` : ""}`,
        }));

        heartbeat = setInterval(() => {
          emit(controller, "status", makeStatusEvent("waiting-provider", "Aguardando resposta do modelo", {
            detail: "Streaming de status ativo",
          }));
        }, 2500);

        const rawResponse = await callProvider(body, prompt);
        rounds[0] = { ...rounds[0], rawResponse };
        emit(controller, "trace", buildTrace(body, [...rounds], null));
        emit(controller, "status", makeStatusEvent("response", "Resposta bruta recebida do provedor"));
        emit(controller, "status", makeStatusEvent("parsing", "Validando e interpretando o JSON retornado"));

        let result: GeneratedQuestion;
        try {
          result = parser(rawResponse);
        } catch (error) {
          rounds[0] = {
            ...rounds[0],
            error: error instanceof Error ? error.message : "Falha ao interpretar resposta da IA.",
            succeeded: false,
          };
          const trace = buildTrace(body, [...rounds], null);
          emit(controller, "trace", trace);
          emit(controller, "status", makeStatusEvent("failed", "Falha ao interpretar a resposta da IA", {
            tone: "error",
            detail: error instanceof Error ? error.message : "Resposta incompatível com o schema esperado.",
          }));
          emit(controller, "error", {
            message: error instanceof Error ? error.message : "Erro ao interpretar resposta da IA.",
            trace,
          });
          return;
        }

        rounds[0] = {
          ...rounds[0],
          resultJson: JSON.stringify(result, null, 2),
          succeeded: true,
        };
        const trace = buildTrace(body, [...rounds], 1);
        emit(controller, "trace", trace);
        emit(controller, "result", { ...result, disciplineId: body.disciplineId });
        emit(controller, "status", makeStatusEvent("completed", "Questão gerada com sucesso", {
          tone: "success",
        }));
      } catch (error) {
        if (rounds[0]) {
          rounds[0] = {
            ...rounds[0],
            error: error instanceof Error ? error.message : "Erro inesperado durante a geração.",
            succeeded: false,
          };
          emit(controller, "trace", buildTrace(body, [...rounds], null));
        }
        emit(controller, "status", makeStatusEvent("failed", "Geração interrompida", {
          tone: "error",
          detail: error instanceof Error ? error.message : "Erro inesperado.",
        }));
        emit(controller, "error", { message: error instanceof Error ? error.message : "Erro ao gerar questão." });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
