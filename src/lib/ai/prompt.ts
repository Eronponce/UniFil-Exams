export interface GeneratedQuestion {
  statement: string;
  options: [string, string, string, string, string];
  correctIndex: number;
  explanation: string;
  thematicArea?: string;
}

export function buildPrompt(discipline: string, topic: string): string {
  return `Você é um especialista na disciplina "${discipline}" criando questões de prova objetivas universitárias.

Crie UMA questão objetiva de múltipla escolha sobre: "${topic}".

Responda APENAS com JSON válido neste formato:
{
  "statement": "enunciado completo da questão",
  "options": ["texto puro sem prefixo de letra", "alternativa B", "alternativa C", "alternativa D", "alternativa E"],
  "correctIndex": 2,
  "explanation": "Por que a correta está certa e as demais estão erradas",
  "thematic_area": "subtópico específico (ex: Herança, TCP/IP, Normalização)"
}

Regras:
- Exatamente 5 alternativas, texto puro sem "A)", "B)" etc
- correctIndex entre 0 e 4 (não sempre 0)
- 4 distratores baseados em erros conceituais reais de estudantes
- Explicação deve justificar a correta E apontar o erro dos distratores
- Não adicione texto fora do JSON`;
}

export function parseResponse(raw: string): GeneratedQuestion {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta não contém JSON válido");
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  if (
    typeof parsed.statement !== "string" ||
    !Array.isArray(parsed.options) ||
    parsed.options.length !== 5 ||
    typeof parsed.correctIndex !== "number"
  ) {
    throw new Error("Estrutura do JSON inválida");
  }
  const stripPrefix = (s: string) => s.replace(/^[A-Ea-e1-5][\)\.\-]\s*/, "").trim();
  return {
    statement: parsed.statement,
    options: (parsed.options as string[]).map(stripPrefix) as [string, string, string, string, string],
    correctIndex: parsed.correctIndex,
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    thematicArea: typeof parsed.thematic_area === "string" && parsed.thematic_area ? parsed.thematic_area : undefined,
  };
}
