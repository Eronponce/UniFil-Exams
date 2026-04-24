export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrate } = await import("./lib/db/schema");
    migrate();

    const { registerHandler } = await import("./lib/task-queue");
    const { auditQuestion } = await import("./lib/db/questions");

    registerHandler("audit", async (task) => {
      const { questionId, value } = task.payload as { questionId: number; value: boolean };
      auditQuestion(questionId, value);
    });

    registerHandler("ai-generate", async (task) => {
      const { generateBatchQuestions } = await import("./lib/ai/batch-prompt");
      const { disciplineName, rawText, provider, questionType, ollamaModel } = task.payload as {
        disciplineName: string;
        rawText: string;
        provider: "claude" | "gemini" | "ollama";
        questionType: import("./types").QuestionType;
        ollamaModel?: string;
      };
      const result = await generateBatchQuestions(disciplineName, rawText, provider, questionType, ollamaModel);
      return result;
    });

    registerHandler("ai-generate-single", async (task) => {
      const { generateQuestion } = await import("./lib/ai/generate");
      const { disciplineName, topic, provider, questionType, ollamaModel } = task.payload as {
        disciplineName: string;
        topic: string;
        provider: "claude" | "gemini" | "ollama";
        questionType: import("./types").QuestionType;
        ollamaModel?: string;
      };
      return generateQuestion(provider, disciplineName, topic, questionType, ollamaModel);
    });
  }
}
