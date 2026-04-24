import { registerHandler } from "@/lib/task-queue";

let registered = false;

export function registerDefaultTaskHandlers() {
  if (registered) return;
  registered = true;

  registerHandler("audit", async (task) => {
    const { auditQuestion } = await import("@/lib/db/questions");
    const { questionId, value } = task.payload as { questionId: number; value: boolean };
    auditQuestion(questionId, value);
  });

  registerHandler("ai-generate", async (task) => {
    const { generateBatchQuestions } = await import("@/lib/ai/batch-prompt");
    const { disciplineName, rawText, provider, questionType, ollamaModel } = task.payload as {
      disciplineName: string;
      rawText: string;
      provider: "claude" | "gemini" | "ollama";
      questionType: import("@/types").QuestionType;
      ollamaModel?: string;
    };
    return generateBatchQuestions(disciplineName, rawText, provider, questionType, ollamaModel);
  });

  registerHandler("ai-generate-single", async (task) => {
    const { generateQuestion } = await import("@/lib/ai/generate");
    const { disciplineName, topic, provider, questionType, ollamaModel } = task.payload as {
      disciplineName: string;
      topic: string;
      provider: "claude" | "gemini" | "ollama";
      questionType: import("@/types").QuestionType;
      ollamaModel?: string;
    };
    return generateQuestion(provider, disciplineName, topic, questionType, ollamaModel);
  });
}
