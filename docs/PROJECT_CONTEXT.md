---
title: Project Context
tags:
  - project/context
  - product/current-state
status: active
---

# Project Context

## Stable Facts
- Project name: UniFil Exams.
- Repository started empty on 2026-04-22.
- Current stack: Next.js 16.2.4 + React 19.2.4 + TypeScript + SQLite (`better-sqlite3`).
- Runtime de produção em Docker no host remoto; o repositório local continua sendo a fonte das mudanças.

## Product Scope
- Aplicação web local para criação, auditoria, montagem e exportação de avaliações.
- Users manage disciplines and reusable question banks.
- Questões podem ser objetivas, verdadeiro/falso, numéricas ou dissertativas, com enunciado HTML sanitizado, resposta, justificativa e imagem opcional.
- Users can manually audit, edit, delete, and create questions.
- IA pode gerar questões estruturadas dos quatro tipos para revisão humana.
- Exams are assembled from selected questions into multiple randomized sets.
- Cada set preserva a sequência `objetiva → verdadeiro/falso → numérica → dissertativa` e randomiza questões/alternativas quando aplicável.
- A montagem oferece ordem compacta opcional, que agrupa `column` antes de `full` dentro de cada tipo para reduzir transições de largura e áreas vazias.
- Each set exports a print-ready PDF and a separate answer key CSV.
- Each PDF includes the EvalBee image for that set on the last page.

## Current Product State
- `/exams` usa um editor visual client-side: selecao exata do pool auditado, ordem manual canonica (`objetiva -> V/F -> numerica -> dissertativa`, meia antes de total), largura por questao e preview A4 por Set.
- O rascunho visual usa `draftSeed` estavel e `buildDraftPrintPayload` para manter sets deterministas enquanto o professor edita; 25..100% de escala de imagem vive no estado do rascunho.
- O preview standalone recomputa quando o payload muda, inicializa escalas persistidas com precedencia para query, e exibe a sidebar de imagem sempre aberta; modo embedded esconde toolbar e controles.
- Fragmentos incompletos de objetivas continuam sempre na pagina fisica seguinte e carregam marcador medido `Questao N continua na proxima pagina ->`.
- Banco de questões já implementado com CRUD, auditoria e importação/exportação.
- Tipos suportados: `objetiva`, `verdadeiro_falso`, `numerica`, `dissertativa`.
- Criação manual aceita imagem por arquivo ou colagem `Ctrl/Cmd + V`, com preview e remoção antes do envio.
- Banco de questões possui filtro para registros sem área temática (`NULL` ou vazio normalizado).
- Geração IA já possui trace detalhado e agora também expõe status em tempo real durante a execução.
- Geração IA individual e em lote usa fila em memória como fluxo principal; resultado é recuperável via `?task=`.
- Feedback de processos usa toast global para geração IA, salvamentos, uploads, importações, auditoria e criação de prova.
- Montagem aceita quantidades, largura por tipo, largura individual, quebra opcional de objetivas longas e ordem aleatória compacta.
- Imagens impressas acompanham a largura da questão e são reduzidas proporcionalmente ao ultrapassar 25% da área imprimível ou metade da altura da página.
- O preview de impressão permite reduzir imagens individualmente de 100% a 25% da largura segura; o estado normalizado fica em `?imageScale=` e é encaminhado ao PDF direto sem tocar no banco ou em versões históricas.
- Exportação PDF agora tenta encaixar seções subsequentes na sobra da página anterior antes de abrir nova página.
- Exportação PDF usa contagem uniforme e par de páginas por set dentro do mesmo lote; PDF individual por set respeita o alvo do lote.
- Documentação Obsidian versionável vive em `docs/`; comece por [[INDEX]].

## Current Assumptions
- Keep docs markdown-first and Obsidian-friendly.
- Use persistent local memory for continuity, but avoid duplicating codebase facts that agents can inspect directly.
- V1 is local-first, single-user, no login.

## Open Questions
- Exact implementation timeline and phase split.
- Real browser smoke of live AI streaming UX with each provider.
- Fine-tuning of PDF layout density after real teacher feedback.
