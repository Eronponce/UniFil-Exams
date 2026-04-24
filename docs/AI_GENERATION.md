---
title: AI Generation
tags:
  - system/ai
  - product/questions
aliases:
  - Geracao com IA
status: draft
---

# AI Generation

V1 usa IA para sugerir questoes objetivas. Nada gerado por IA entra no banco sem revisao do usuario.

## Provedores
- Qwen3.5 9B em Q4_K_M local, via Ollama ou llama.cpp.
- Claude API.
- Gemini API.

## Comportamento
- Usuario escolhe o provedor em cada geracao.
- Sistema aplica prompt padronizado.
- Resposta esperada: questao objetiva estruturada com enunciado, cinco alternativas e correta.
- Sistema valida estrutura antes de permitir salvar.

## Prompt Base
- Criar questao objetiva para a disciplina e tema informados.
- Gerar exatamente cinco alternativas: A, B, C, D, E.
- Indicar uma unica alternativa correta.
- Manter alternativas com tamanho e nivel de detalhe equilibrados.
- Evitar que a correta fique visualmente obvia por ser maior, mais tecnica ou mais especifica.
- Evitar alternativas absurdas ou muito fracas.
- Retornar formato estruturado validavel.

## Revisao Humana
> [!important]
> IA auxilia criacao. Auditoria humana continua obrigatoria antes de usar questao em prova.

## Falhas Esperadas
- IA retorna menos de cinco alternativas.
- IA nao indica correta.
- IA gera alternativa correta muito evidente.
- Provedor local indisponivel.
- Chave de API ausente ou invalida.

## Politica V1
- Mostrar erro claro e preservar texto do pedido do usuario.
- Nao salvar resposta invalida automaticamente.
- Permitir editar a questao gerada antes de salvar.

## Tipos de questão suportados (2026-04-24)
- `objetiva`: 5 alternativas (A–E), `correctIndex` 0–4, `explanation` (justificativa).
- `verdadeiro_falso`: `correctIndex` 0 = Verdadeiro, 1 = Falso, `explanation`.
- `dissertativa`: `answerLines` (linhas em branco para resposta), `explanation` = gabarito esperado.

## Fila de geracao em background (2026-04-24)
- `/ai` usa `enqueueSingleAiGenerationAction` para gerar uma questao individual em background.
- `/ai/import` usa `enqueueAiGenerationAction` para gerar lotes em background.
- `instrumentation.ts` registra `ai-generate-single` e `ai-generate`.
- A fila usa singleton em `globalThis` para ser compartilhada entre Server Actions e rotas `/api/queue`.
- Tarefa sobrevive navegacao de pagina enquanto o servidor Node.js estiver ativo.
- Ao concluir, o `QueuePanel` exibe link "Ver": `/ai?task=[taskId]` para individual ou `/ai/import?task=[taskId]` para lote.
- As paginas tambem fazem polling do `taskId` ativo e carregam resultado automaticamente quando ele fica pronto.
- Deduplicacao por `dedupKey` evita submissao dupla enquanto a tarefa esta aguardando ou processando.

## Observabilidade
- `QueuePanel` mostra status global: aguardando, processando, concluida, erro ou cancelada.
- `AITracePanel` mostra trace final quando o usuario abre uma tarefa concluida.
- Rotas SSE antigas (`/api/ai/generate/stream` e `/api/ai/batch/stream`) ainda existem, mas o fluxo de usuario agora prioriza fila.
