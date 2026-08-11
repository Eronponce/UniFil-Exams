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
    '- Use exatamente os campos: "statement", "questionType", "options", "correctIndex", "difficulty", "thematicArea", "explanation", "answerLines", "correctAnswer".',
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
      '- "correctAnswer" deve ser "" (vazio).',
    ].join("\n");
  }

  if (questionType === "numerica") {
    return [
      '- "options" deve ser um array vazio: [].',
      '- "correctIndex" deve ser 0.',
      '- O statement deve exigir do aluno uma sequencia numerica como resposta (ex: ordenacao, calculo, resultado).',
      '- "correctAnswer" deve conter somente digitos, espacos ou virgulas (ex: "42" ou "3 1 4 2" ou "1,2,3").',
      '- "answerLines" deve ser 0.',
      '- "explanation" deve justificar como chegar ao valor correto.',
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
  "answerLines": 8,
  "correctAnswer": ""
}`;
  }

  if (questionType === "numerica") {
    return `{
  "statement": "Coloque em ordem crescente os valores: 4, 2, 7, 1",
  "questionType": "numerica",
  "options": [],
  "correctIndex": 0,
  "difficulty": "medium",
  "thematicArea": "Subtopico especifico",
  "explanation": "A ordem crescente correta e 1 2 4 7",
  "answerLines": 0,
  "correctAnswer": "1 2 4 7"
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
  "answerLines": 0,
  "correctAnswer": ""
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
  if (questionType === "numerica") {
    return `Crie UMA questao numerica sobre: "${topic}" cuja resposta seja uma sequencia de numeros.`;
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
  if (questionType === "numerica") {
    return variant === "minimal"
      ? "Gere questoes numericas a partir do texto."
      : "Analise o texto abaixo e gere uma questao numerica para cada topico relevante que envolva sequencia ou calculo numerico.";
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

function buildImportFormatRules(): string {
  return [
    "- Retorne apenas JSON válido, sem markdown e sem texto fora do objeto.",
    '- Use exatamente os nove campos por questão: "statement", "questionType", "options", "correctIndex", "difficulty", "thematicArea", "explanation", "answerLines", "correctAnswer".',
    '- Não adicione campos extras em nenhum nível da resposta.',
    '- difficulty deve ser "easy", "medium" ou "hard".',
    '- questionType deve ser "objetiva", "verdadeiro_falso", "dissertativa" ou "numerica".',
    "- Preserve exatamente a estrutura superior do template fornecido: um objeto com {version, exportedAt, questions:[...]}.",
    '- Mantenha os campos superiores "version" e "exportedAt" e a propriedade "questions"; não renomeie, remova ou acrescente propriedades superiores.',
    "- Cada item de questions deve conter somente os nove campos exatos descritos acima.",
    buildHtmlRules(),
  ].join("\n");
}

function buildImportConstructionRules(): string {
  return [
    "Antes de criar cada questão, defina internamente:",
    "conteúdo → recorte específico → habilidade que será avaliada → contexto → problema → evidências ou dados → restrições → resposta esperada",
    "- Sempre que possível, crie questões aplicadas.",
    "- Uma boa questão deve apresentar uma situação em que o aluno precise usar o conteúdo para analisar, aplicar, avaliar, diagnosticar, escolher ou propor uma solução.",
    "- Evite questões baseadas apenas em memorização de definição quando o conteúdo permitir aplicação.",
    "- O contexto deve influenciar a resposta. Não crie histórias decorativas.",
    "- Podem ser utilizados dados, métricas, código, tabelas, sintomas, requisitos, resultados, logs, regras, diagramas ou restrições.",
  ].join("\n");
}

function buildImportTradeoffRules(): string {
  return [
    "Sempre que adequado, apresente mais de um critério relevante ou algum trade-off.",
    "Exemplos: desempenho versus custo; segurança versus disponibilidade; precisão versus explicabilidade; simplicidade versus escalabilidade; consistência versus disponibilidade.",
    "A resposta correta deve ser aquela que melhor atende ao conjunto do cenário.",
  ].join("\n");
}

function buildImportDiversityRules(): string {
  return [
    "Antes de criar uma nova questão, considere todas as questões já produzidas.",
    "Não crie duas questões que permitam ao aluno descobrir diretamente a resposta de uma pela outra.",
    "É proibido criar:",
    "- uma questão que seja a inversão de outra;",
    "- uma afirmação verdadeira em uma questão e sua negação em outra;",
    "- duas questões com o mesmo fato central perguntado de formas diferentes;",
    "- duas questões cuja resposta correta revele diretamente a resposta da outra;",
    "- uma questão objetiva e outra verdadeiro ou falso sobre exatamente a mesma conclusão;",
    "- questões que reutilizem o mesmo raciocínio mudando apenas nomes, números ou contexto superficial;",
    "- questões que funcionem como pista ou gabarito indireto para outra questão.",
    "- Questões podem abordar conteúdos próximos ou o mesmo tema, desde que avaliem aspectos diferentes e não permitam inferir diretamente os gabaritos umas das outras.",
    "Exemplo aceitável: uma questão pergunta qual estrutura de dados atende melhor determinado cenário; outra pergunta sobre a complexidade de uma operação diferente, desde que conhecer a resposta da primeira não revele automaticamente a segunda.",
    "Exemplo proibido: uma questão afirma que tabela hash possui busca média O(1) e outra pergunta se é falso afirmar que tabela hash possui busca média O(1); responder uma praticamente responde a outra.",
  ].join("\n");
}

function buildImportQuestionTypeRules(questionType: QuestionType): string {
  if (questionType === "verdadeiro_falso") {
    return [
      '- "options" deve ser exatamente ["Verdadeiro", "Falso"].',
      '- "correctIndex" deve ser 0 para Verdadeiro e 1 para Falso.',
      "- O statement deve ser uma afirmação factual, clara e sem ambiguidade.",
      "- Misture afirmações verdadeiras e falsas quando houver várias questões.",
      "- Não transforme diretamente uma questão objetiva já criada em verdadeiro ou falso.",
      "- Não utilize a negação de uma afirmação já avaliada em outra questão.",
      '- "answerLines" deve ser 0.',
    ].join("\n");
  }

  if (questionType === "dissertativa") {
    return [
      '- "options" deve ser [].',
      '- "correctIndex" deve ser 0.',
      "- O statement deve pedir uma resposta aberta, específica e delimitada.",
      '- "explanation" deve conter o gabarito esperado em até 3 frases curtas.',
      '- "answerLines" deve ficar entre 4 e 12.',
      '- "correctAnswer" deve ser "".',
    ].join("\n");
  }

  if (questionType === "numerica") {
    return [
      '- "options" deve ser [].',
      '- "correctIndex" deve ser 0.',
      "- O statement deve exigir uma sequência numérica.",
      "- Todos os dados necessários devem estar no enunciado.",
      '- "correctAnswer" deve conter somente dígitos, espaços ou vírgulas.',
      '- "answerLines" deve ser 0.',
      '- "explanation" deve explicar como chegar ao resultado.',
    ].join("\n");
  }

  return [
    '- "options" deve ter exatamente 5 alternativas.',
    '- Não use prefixos como A), B), C), D) ou E).',
    "- Apenas uma alternativa pode ser correta.",
    '- "correctIndex" deve variar entre 0 e 4 ao longo do conjunto.',
    "- Evite padrões previsíveis de gabarito.",
    "- Crie 4 distratores plausíveis e tecnicamente relacionados.",
    "- Não crie alternativas absurdas ou obviamente erradas sem análise.",
    '- "answerLines" deve ser 0.',
    '- "explanation" deve justificar a correta e explicar o erro das incorretas.',
    "Os distratores devem preferencialmente representar:",
    "- solução parcialmente correta;",
    "- conceito correto aplicado no contexto errado;",
    "- generalização indevida;",
    "- solução desproporcional;",
    "- erro de causa e efeito;",
    "- restrição ignorada;",
    "- trade-off mal priorizado.",
  ].join("\n");
}

function buildImportDifficultyRules(): string {
  return [
    "easy",
    "Aplicação direta, poucas variáveis e um conceito principal.",
    "medium",
    "Combinação de critérios, interpretação de contexto ou algum trade-off.",
    "hard",
    "Múltiplos critérios, integração de conceitos, interpretação de evidências e distratores próximos da resposta correta.",
  ].join("\n");
}

function buildImportFinalReviewRules(): string {
  return [
    "Antes de finalizar, revise o conjunto inteiro e confirme internamente que:",
    "- nenhuma questão é duplicada;",
    "- nenhuma questão é inversão de outra;",
    "- nenhuma questão entrega a resposta de outra;",
    "- nenhuma questão é apenas uma paráfrase de outra;",
    "- questões do mesmo tema avaliam habilidades ou aspectos diferentes;",
    "- existe apenas uma resposta correta em cada questão objetiva;",
    "- o JSON está sintaticamente válido;",
    "- todos os campos seguem exatamente o template.",
    "Retorne somente o JSON final.",
  ].join("\n");
}

export function buildImportPrompt(): string {
  return `Você receberá um arquivo de template em anexo com o formato de questões esperado.

Gere questões estritamente nesse formato JSON, respeitando todas as regras abaixo.

FORMATO SUPERIOR OBRIGATÓRIO
Mantenha exatamente esta estrutura superior do template fornecido:
{
  "version": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "questions": [
    {
      "statement": "Enunciado",
      "questionType": "objetiva",
      "options": ["Alternativa 1", "Alternativa 2", "Alternativa 3", "Alternativa 4", "Alternativa 5"],
      "correctIndex": 0,
      "difficulty": "medium",
      "thematicArea": "Subtema específico",
      "explanation": "Justificativa",
      "answerLines": 0,
      "correctAnswer": ""
    }
  ]
}

REGRAS GERAIS
${buildImportFormatRules()}

CONSTRUÇÃO DAS QUESTÕES
${buildImportConstructionRules()}

QUESTÕES MÉDIAS E DIFÍCEIS
${buildImportTradeoffRules()}

DIVERSIDADE ENTRE QUESTÕES
${buildImportDiversityRules()}

QUESTÕES OBJETIVAS (questionType: "objetiva")
${buildImportQuestionTypeRules("objetiva")}

QUESTÕES VERDADEIRO OU FALSO (questionType: "verdadeiro_falso")
${buildImportQuestionTypeRules("verdadeiro_falso")}

QUESTÕES DISSERTATIVAS (questionType: "dissertativa")
${buildImportQuestionTypeRules("dissertativa")}

QUESTÕES NUMÉRICAS (questionType: "numerica")
${buildImportQuestionTypeRules("numerica")}

CONTROLE DE DIFICULDADE
${buildImportDifficultyRules()}

REVISÃO FINAL
${buildImportFinalReviewRules()}`;
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
