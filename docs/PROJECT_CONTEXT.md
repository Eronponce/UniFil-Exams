# Project Context

## Stable Facts
- Project name: UniFil Exams.
- Repository started empty on 2026-04-22.
- Current stack: Next.js 16.2.4 + React 19.2.4 + TypeScript + SQLite (`better-sqlite3`).
- No remote `origin` is configured at scaffold time.

## Product Scope
- Local web app for objective exam creation, auditing, generation, assembly, and export.
- Users manage disciplines and reusable question banks.
- Questions have statement, alternatives A-E, correct answer, and optional image.
- Users can manually audit, edit, delete, and create questions.
- AI can generate structured objective questions for human review.
- Exams are assembled from selected questions into multiple randomized sets.
- Each set randomizes question order and alternative order.
- Each set exports a print-ready PDF and a separate answer key CSV.
- Each PDF includes the EvalBee image for that set on the last page.

## Current Product State
- Banco de questões já implementado com CRUD, auditoria e importação/exportação.
- Tipos suportados: `objetiva`, `verdadeiro_falso`, `dissertativa`.
- Geração IA já possui trace detalhado e agora também expõe status em tempo real durante a execução.
- Geração IA individual e em lote usa fila em memória como fluxo principal; resultado é recuperável via `?task=`.
- Feedback de processos usa toast global para geração IA, salvamentos, uploads, importações, auditoria e criação de prova.
- Montagem de prova aceita seleção por quantidade de cada tipo de questão.
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
