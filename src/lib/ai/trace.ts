export interface TraceRound {
  round: number;
  prompt: string;
  rawResponse?: string;  // disponível apenas no fluxo single-question (callOllama/Claude/Gemini direto)
  resultJson?: string;   // JSON.stringify do objeto parseado quando sucesso
  error?: string;
  succeeded: boolean;
}

export interface AITrace {
  provider: string;
  model?: string;
  questionType: string;
  rounds: TraceRound[];
  succeededRound: number | null;
}
