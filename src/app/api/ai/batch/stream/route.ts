import { generateBatchQuestions, type BatchGenerationProgress } from "@/lib/ai/batch-prompt";
import { makeStatusEvent, type BatchStreamRequest } from "@/lib/ai/stream";
import { getDiscipline } from "@/lib/db/disciplines";

const encoder = new TextEncoder();

function emit(controller: ReadableStreamDefaultController<Uint8Array>, type: string, payload: unknown) {
  controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`));
}

function emitProgress(
  controller: ReadableStreamDefaultController<Uint8Array>,
  progress: BatchGenerationProgress,
) {
  emit(controller, "trace", progress.trace);
  emit(controller, "status", makeStatusEvent(progress.phase, progress.message, {
    round: progress.round,
    tone: progress.phase === "round-failure" ? "warning" : progress.phase === "round-success" ? "success" : "info",
  }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as BatchStreamRequest | null;
  if (!body) return new Response("Payload inválido.", { status: 400 });

  if (!body.disciplineId || !body.rawText?.trim()) {
    return new Response("Disciplina e texto são obrigatórios.", { status: 400 });
  }

  const discipline = getDiscipline(body.disciplineId);
  if (!discipline) return new Response("Disciplina não encontrada.", { status: 404 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      try {
        emit(controller, "status", makeStatusEvent("validating", "Parâmetros validados"));
        emit(controller, "status", makeStatusEvent("starting", "Iniciando geração em lote"));

        heartbeat = setInterval(() => {
          emit(controller, "status", makeStatusEvent("waiting-provider", "Aguardando retorno do modelo", {
            detail: "Novas rodadas aparecem aqui em tempo real.",
          }));
        }, 2500);

        const { questions, trace } = await generateBatchQuestions(
          discipline.name,
          body.rawText.trim(),
          body.provider,
          body.questionType,
          body.ollamaModel,
          (progress) => emitProgress(controller, progress),
        );

        emit(controller, "trace", trace);
        emit(controller, "results", { questions, disciplineId: body.disciplineId });
        emit(controller, "status", makeStatusEvent("completed", "Lote gerado com sucesso", {
          tone: "success",
          detail: `${questions.length} questão(ões) pronta(s) para revisão.`,
        }));
      } catch (error) {
        const trace = (error as Record<string, unknown>).trace;
        if (trace) emit(controller, "trace", trace);
        emit(controller, "status", makeStatusEvent("failed", "Falha na geração em lote", {
          tone: "error",
          detail: error instanceof Error ? error.message : "Erro inesperado.",
        }));
        emit(controller, "error", {
          message: error instanceof Error ? error.message : "Erro ao gerar lote de questões.",
          trace,
        });
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
