---
title: Importação de questões e prompt para LLM
tags:
  - system/import
  - system/ai
  - product/questions
aliases:
  - Importar questões
status: active
---

# Importação de questões e prompt para LLM

`/questions/importar` aceita arquivos JSON e CSV, mostra uma prévia editável e só grava no banco depois que o professor seleciona as questões e a disciplina de destino.

## Fluxo recomendado

1. Abra **Criar → Importar questões**.
2. Preencha **Assunto/tema das questões**. Esse valor é o eixo temático do conjunto.
3. Informe a quantidade desejada em cada campo: **Objetivas**, **Verdadeiro ou falso**, **Numéricas** e **Dissertativas**.
4. Baixe ou copie o prompt completo exibido na tela.
5. Anexe o template JSON (recomendado) à LLM e cole o prompt. O prompt também contém o template completo no final, portanto pode ser enviado como um único arquivo Markdown.
6. Salve a resposta da LLM em `.json`, carregue-a no importador, revise a prévia e selecione a disciplina.
7. Confirme **Importar selecionadas**. A validação do schema acontece antes da persistência.

## Saída obrigatória da LLM

A resposta da LLM deve ser um único arquivo JSON pronto para salvar como `.json`. Ela deve começar com `{` e terminar com `}`, sem bloco `\`\`\`json`, Markdown, CSV, comentários ou texto adicional. O bloco JSON exibido no fim do prompt é somente referência do formato; não deve ser repetido como explicação fora do arquivo retornado.

## Assunto e quantidades

O prompt nomeia o assunto como `ASSUNTO/TEMA DA PROVA` e repete essa referência nas regras de escopo, construção, dificuldade, distratores, diversidade e fidelidade aos materiais.

| Campo na tela | `questionType` esperado | Regra |
| --- | --- | --- |
| Objetivas | `objetiva` | Exatamente 5 alternativas e uma correta |
| Verdadeiro ou falso | `verdadeiro_falso` | `['Verdadeiro', 'Falso']` |
| Numéricas | `numerica` | Resposta em dígitos, espaços ou vírgulas |
| Dissertativas | `dissertativa` | Sem alternativas; 4–12 linhas de resposta |

Os valores de quantidade são instruções do prompt, não aparecem como campos no JSON final. `0` significa não gerar questões daquele tipo. A LLM deve colocar todos os itens no array `questions` e respeitar exatamente a soma solicitada.

## JSON ou CSV?

JSON é o formato recomendado para geração por LLM porque preserva arrays, números, índices, strings multilinha e o envelope do template sem depender de regras de escape de planilha.

CSV continua disponível para edição tabular, conferência em Excel/Sheets e intercâmbio com ferramentas que não consomem JSON. Para gerar questões com alternativas e HTML, CSV é mais suscetível a problemas de aspas, vírgulas e quebras de linha.

## Contrato JSON

O objeto superior permanece:

```json
{
  "version": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "questions": []
}
```

Cada item de `questions` deve possuir somente estes nove campos:

`statement`, `questionType`, `options`, `correctIndex`, `difficulty`, `thematicArea`, `explanation`, `answerLines`, `correctAnswer`.

Não adicione assunto, quantidade, ID, comentários ou outros metadados ao JSON. O assunto e as quantidades pertencem às instruções do prompt; o ID é criado pelo banco depois da importação.

## Regras de qualidade do prompt

- Questões aplicadas devem usar contexto, problema, evidências, restrições e decisão quando isso fizer sentido para o assunto.
- A dificuldade deve vir do raciocínio, não de ambiguidade ou vocabulário artificial.
- Distratores devem representar erros plausíveis: solução parcial, conceito mal aplicado, generalização, solução desproporcional, causa/sintoma, restrição ignorada ou trade-off mal priorizado.
- Questões do mesmo assunto podem existir, mas não podem entregar o gabarito umas das outras.
- O `statement` aceita somente o HTML sanitizado descrito no prompt; scripts, eventos, `class`, `id`, URLs em `style` e elementos executáveis são proibidos.
- Toda questão passa por prévia e revisão humana antes de entrar no banco e ser usada em uma prova.

## CSV de entrada

O cabeçalho aceito é:

`statement,question_type,difficulty,option_a,option_b,option_c,option_d,option_e,correct_index,thematic_area,answer_lines,explanation,correct_answer`

O parser trata campos CSV com aspas, vírgulas e quebras de linha. Mesmo assim, use JSON quando o arquivo for produzido por uma LLM.

## Relação com provas e EvalBee

Depois que as questões importadas forem usadas em uma prova, a referência para correção é o mapa em [Exports and EvalBee](EXPORTS_EVALBEE.md). A geração da prova salva a questão do banco, a posição no set e a ordem embaralhada das alternativas; isso permite cruzar o resultado do EvalBee com o ID original.

## Fonte de implementação

- Prompt centralizado: `src/lib/ai/prompt-templates.ts` (`buildImportPrompt`).
- Interface e cópia do prompt: `src/app/(app)/questions/importar/import-file-client.tsx`.
- Schema e parser: `src/lib/importexport/types.ts`.
