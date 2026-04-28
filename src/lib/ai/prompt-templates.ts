import type { QuestionType } from "@/types";
import {
  RICH_TEXT_ALLOWED_ATTRIBUTE_LABEL,
  RICH_TEXT_ALLOWED_STYLE_LABEL,
  RICH_TEXT_ALLOWED_TAGS_LABEL,
  RICH_TEXT_BLOCKED_FEATURES_LABEL,
} from "@/lib/html/rich-text";

type PromptVariant = "full" | "simple" | "minimal";

function buildHtmlRules(): string {
  return [
    '- O campo "statement" pode conter HTML sanitizado.',
    `- Tags permitidas no statement: ${RICH_TEXT_ALLOWED_TAGS_LABEL}.`,
    `- Atributos permitidos no statement: ${RICH_TEXT_ALLOWED_ATTRIBUTE_LABEL}.`,
    `- Styles permitidos no statement: ${RICH_TEXT_ALLOWED_STYLE_LABEL}.`,
    `- ${RICH_TEXT_BLOCKED_FEATURES_LABEL}.`,
  ].join("\n");
}

function buildGeneralRules(questionType: QuestionType): string {
  return [
    "- Retorne apenas JSON valido, sem markdown e sem texto fora do objeto.",
    '- Use exatamente os campos: "statement", "questionType", "options", "correctIndex", "difficulty", "thematicArea", "explanation", "answerLines".',
    `- questionType deve ser "${questionType}".`,
    '- difficulty deve ser "easy", "medium" ou "hard".',
    buildHtmlRules(),
  ].join("\n");
}

function buildQuestionTypeRules(questionType: QuestionType): string {
  if (questionType === "verdadeiro_falso") {
    return [
      '- "options" deve ser exatamente ["Verdadeiro", "Falso"].',
      '- "correctIndex" deve ser 0 para Verdadeiro e 1 para Falso.',
      '- O statement deve ser uma afirmacao factual, clara e sem ambiguidade.',
      '- Misture afirmacoes verdadeiras e falsas quando houver mais de uma questao.',
      '- "answerLines" deve ser 0.',
    ].join("\n");
  }

  if (questionType === "dissertativa") {
    return [
      '- "options" deve ser um array vazio: [].',
      '- "correctIndex" deve ser 0.',
      '- O statement deve pedir uma resposta aberta, delimitada e especifica.',
      '- "explanation" deve conter o gabarito esperado em ate 3 frases curtas.',
      '- "answerLines" deve ficar entre 4 e 12, proporcional a complexidade.',
    ].join("\n");
  }

  return [
    '- "options" deve ter exatamente 5 alternativas, sem prefixos "A)", "B)" etc.',
    '- Apenas UMA alternativa correta; "correctIndex" deve variar entre 0 e 4.',
    '- Crie 4 distratores plausiveis, tecnicamente relacionados e nao triviais.',
    '- Evite alternativas absurdas ou obviamente erradas sem analise.',
    '- "explanation" deve justificar a correta e apontar o erro das incorretas.',
    '- "answerLines" deve ser 0.',
  ].join("\n");
}

function buildSingleJsonShape(questionType: QuestionType): string {
  if (questionType === "verdadeiro_falso") {
    return `{
  "statement": "Afirmacao factual clara e completa",
  "questionType": "verdadeiro_falso",
  "options": ["Verdadeiro", "Falso"],
  "correctIndex": 0,
  "difficulty": "medium",
  "thematicArea": "Subtopico especifico",
  "explanation": "Justificativa curta da afirmacao",
  "answerLines": 0
}`;
  }

  if (questionType === "dissertativa") {
    return `{
  "statement": "Explique/compare/descreva...",
  "questionType": "dissertativa",
  "options": [],
  "correctIndex": 0,
  "difficulty": "medium",
  "thematicArea": "Subtopico especifico",
  "explanation": "Gabarito esperado em poucas frases",
  "answerLines": 8
}`;
  }

  return `{
  "statement": "Enunciado completo da questao",
  "questionType": "objetiva",
  "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D", "Alternativa E"],
  "correctIndex": 2,
  "difficulty": "medium",
  "thematicArea": "Subtopico especifico",
  "explanation": "Por que a correta esta certa e as demais estao erradas",
  "answerLines": 0
}`;
}

function buildBatchJsonShape(questionType: QuestionType): string {
  return `{
  "questions": [
    ${buildSingleJsonShape(questionType).replace(/\n/g, "\n    ")}
  ]
}`;
}

function buildSingleObjective(questionType: QuestionType, topic: string): string {
  if (questionType === "verdadeiro_falso") {
    return `Crie UMA proposicao de verdadeiro ou falso sobre: "${topic}".`;
  }
  if (questionType === "dissertativa") {
    return `Crie UMA questao dissertativa sobre: "${topic}".`;
  }
  return `Crie UMA questao objetiva de nivel universitario sobre: "${topic}".`;
}

function buildBatchObjective(questionType: QuestionType, variant: PromptVariant): string {
  if (questionType === "verdadeiro_falso") {
    return variant === "minimal"
      ? "Gere proposicoes de verdadeiro ou falso a partir do texto."
      : "Analise o texto abaixo e gere uma proposicao de verdadeiro ou falso para cada topico relevante identificado.";
  }
  if (questionType === "dissertativa") {
    return variant === "minimal"
      ? "Gere questoes dissertativas a partir do texto."
      : "Analise o texto abaixo e gere uma questao dissertativa aberta para cada topico relevante identificado.";
  }
  return variant === "minimal"
    ? "Gere questoes objetivas a partir do texto."
    : "Analise o texto abaixo e gere uma questao objetiva para cada topico relevante identificado.";
}

function buildBatchExtraRules(questionType: QuestionType, variant: PromptVariant): string {
  const base = buildQuestionTypeRules(questionType);
  if (variant === "minimal") return base;
  return [
    base,
    '- Preserve conteudo tecnico fiel ao texto-base, mas reescreva quando precisar melhorar clareza.',
    '- Se o texto original trouxer alternativas prontas, ignore-as e gere alternativas novas quando for objetiva.',
    '- Use thematicArea para agrupar a questao no subtema mais especifico possivel.',
  ].join("\n");
}

export function buildImportPrompt(): string {
  return `Voce recebera um arquivo de template em anexo com o formato de questoes esperado. Gere questoes estritamente nesse formato JSON, respeitando todas as regras abaixo.

REGRAS GERAIS
${buildGeneralRules("objetiva").replace('questionType deve ser "objetiva".\n', "")}
- questionType pode ser "objetiva", "verdadeiro_falso" ou "dissertativa".

QUESTOES OBJETIVAS (questionType: "objetiva")
${buildQuestionTypeRules("objetiva")}

QUESTOES VERDADEIRO OU FALSO (questionType: "verdadeiro_falso")
${buildQuestionTypeRules("verdadeiro_falso")}

QUESTOES DISSERTATIVAS (questionType: "dissertativa")
${buildQuestionTypeRules("dissertativa")}`;
}

export function buildSingleQuestionPrompt(
  discipline: string,
  topic: string,
  questionType: QuestionType,
): string {
  return `Voce e um especialista na disciplina "${discipline}" criando questoes universitarias.

OBJETIVO
${buildSingleObjective(questionType, topic)}

FORMATO OBRIGATORIO
${buildSingleJsonShape(questionType)}

REGRAS GERAIS
${buildGeneralRules(questionType)}

REGRAS ESPECIFICAS
${buildQuestionTypeRules(questionType)}`;
}

export function buildBatchQuestionPrompt(
  discipline: string,
  rawText: string,
  questionType: QuestionType,
  variant: PromptVariant,
): string {
  const intro =
    variant === "minimal"
      ? `Disciplina: ${discipline}`
      : `Voce e um especialista na disciplina "${discipline}" criando questoes universitarias.`;

  return `${intro}

OBJETIVO
${buildBatchObjective(questionType, variant)}

FORMATO OBRIGATORIO
${buildBatchJsonShape(questionType)}

REGRAS GERAIS
${buildGeneralRules(questionType)}

REGRAS ESPECIFICAS
${buildBatchExtraRules(questionType, variant)}

TEXTO-BASE
${rawText}`;
}
