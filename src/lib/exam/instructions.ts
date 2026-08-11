export const DEFAULT_EXAM_INSTRUCTIONS =
  "Instruções: nas questões objetivas, marque uma única alternativa; nas questões de V/F, assinale Verdadeiro ou Falso; nas questões numéricas, escreva o valor solicitado; e nas questões dissertativas, desenvolva a resposta com clareza. Todas as respostas devem ser preenchidas na folha de respostas, na última folha. Rasuras na prova são permitidas, mas somente a resposta final registrada na folha de respostas será considerada.";

export function normalizeExamInstructions(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_EXAM_INSTRUCTIONS;
  const normalized = value.trim();
  return normalized || DEFAULT_EXAM_INSTRUCTIONS;
}
