import type { QuestionType } from "@/types";

export interface GeneratedQuestion {
  questionType: QuestionType;
  statement: string;
  options: string[];
  correctIndex: number;
  answerLines: number;
  explanation: string;
  thematicArea?: string;
}

// ── Objetiva ──────────────────────────────────────────────────────────────────
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
    questionType: "objetiva",
    statement: parsed.statement,
    options: (parsed.options as string[]).map(stripPrefix),
    correctIndex: parsed.correctIndex,
    answerLines: 0,
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    thematicArea: typeof parsed.thematic_area === "string" && parsed.thematic_area ? parsed.thematic_area : undefined,
  };
}

// ── Verdadeiro ou Falso ───────────────────────────────────────────────────────
export function buildPromptVF(discipline: string, topic: string): string {
  return `Você é um especialista na disciplina "${discipline}" criando questões de prova universitárias.

Crie UMA proposição de Verdadeiro ou Falso sobre: "${topic}".

Responda APENAS com JSON válido neste formato:
{
  "statement": "A proposição como afirmação clara e completa (não uma pergunta)",
  "isTrue": true,
  "explanation": "Justificativa: por que a proposição é verdadeira ou falsa",
  "thematic_area": "subtópico específico"
}

Regras:
- statement deve ser uma afirmação, não uma pergunta
- isTrue: true se a afirmação é correta, false se é incorreta
- Não adicione texto fora do JSON`;
}

export function parseResponseVF(raw: string): GeneratedQuestion {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta não contém JSON válido");
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  if (typeof parsed.statement !== "string") throw new Error("Estrutura do JSON inválida");
  const isTrue = Boolean(parsed.isTrue);
  return {
    questionType: "verdadeiro_falso",
    statement: parsed.statement,
    options: ["Verdadeiro", "Falso"],
    correctIndex: isTrue ? 0 : 1,
    answerLines: 0,
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    thematicArea: typeof parsed.thematic_area === "string" && parsed.thematic_area ? parsed.thematic_area : undefined,
  };
}

// ── Dissertativa ──────────────────────────────────────────────────────────────
export function buildPromptDissertativa(discipline: string, topic: string): string {
  return `Você é um especialista na disciplina "${discipline}" criando questões de prova universitárias.

Crie UMA questão dissertativa sobre: "${topic}".

Responda APENAS com JSON válido neste formato:
{
  "statement": "Enunciado completo que estimule resposta elaborada",
  "answerLines": 8,
  "explanation": "Elementos esperados na resposta do aluno (uso interno, não aparece na prova)",
  "thematic_area": "subtópico específico"
}

Regras:
- statement deve ser questão aberta (use 'Explique', 'Descreva', 'Compare', 'Justifique')
- answerLines: linhas em branco para resposta, inteiro entre 4 e 20
- Não adicione texto fora do JSON`;
}

export function parseResponseDissertativa(raw: string): GeneratedQuestion {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta não contém JSON válido");
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  if (typeof parsed.statement !== "string") throw new Error("Estrutura do JSON inválida");
  const lines = typeof parsed.answerLines === "number" && Number.isInteger(parsed.answerLines)
    ? Math.min(Math.max(parsed.answerLines, 1), 20) : 6;
  return {
    questionType: "dissertativa",
    statement: parsed.statement,
    options: [],
    correctIndex: 0,
    answerLines: lines,
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    thematicArea: typeof parsed.thematic_area === "string" && parsed.thematic_area ? parsed.thematic_area : undefined,
  };
}
