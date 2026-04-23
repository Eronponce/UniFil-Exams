# Session Log

## 2026-04-22
- Created initial project scaffold for empty repository.
- Confirmed repository has no remote `origin`.
- Added base documentation, agent instructions, and local memory file.
- No application stack selected yet.
- Installed RTK `0.37.2` to `C:\Users\eronp\.local\bin\rtk.exe`.
- Cloned RTK source to `C:\Users\eronp\.agents\tools\rtk`.
- Configured Codex RTK awareness at `C:\Users\eronp\.codex\RTK.md`.
- Configured Claude global RTK hook with backup at `C:\Users\eronp\.claude\settings.json.bak`.
- Confirmed Claude `claude-mem@thedotmack` plugin is enabled in `C:\Users\eronp\.claude\settings.json`.
- Added bootstrap checklist for future Codex/Claude sessions.
- Confirmed ASM is installed globally: `asm v2.3.0`.
- Confirmed Codex CLI is installed globally: `codex-cli 0.122.0`.
- Confirmed Claude-mem plugin files exist for Claude version `12.3.8`.
- Checked Codex local plugin state: no `claude-mem` plugin installed in `C:\Users\eronp\.codex`.
- Defined product scope: local objective exam builder with disciplines, question bank, auditing, AI question generation, randomized exam sets, PDF export, EvalBee image by set, and CSV answer keys.
- Chose V1 direction: local web app, Next.js + TypeScript, SQLite, no login.
- Deferred programming-heavy implementation until system structure docs are in place.
- User clarified priority: first place full documentation in the system and install tools; development comes later.
- Installed `@aisuite/chub` globally for external docs/context lookup.
- Verified Ollama client exists (`0.12.3`) but service was not running.

## 2026-04-22 (Fase 1)
- Scaffold Next.js `16.2.4` + React `19.2.4` + TypeScript na raiz do repo.
- `create-next-app` requer nome lowercase; scaffoldado em subpasta `scaffold/`, arquivos movidos manualmente.
- Adicionados: Prettier `^3`, Vitest `^3`, Testing Library `^16`, jsdom `^26`.
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:ui`, `test:coverage`.
- Estrutura de pastas criada: `src/app/`, `src/lib/db/`, `src/lib/ai/`, `src/lib/pdf/`, `src/lib/exam/`, `src/types/`, `src/components/`, `src/tests/`, `public/uploads/`.
- `src/types/index.ts`: tipos base (Discipline, Question, ExamSet, Exam).
- `.env.local.example` criado com variáveis esperadas para Claude API, Gemini, Ollama.
- `scaffold/` adicionada ao `.gitignore`; pode ser removida após confirmação.
- Typecheck: limpo. Vitest: configurado (sem testes ainda, esperado).
- AGENTS.md atualizado com nota de framework Next.js 16 + scripts.

## 2026-04-22 (Fase 2)
- `better-sqlite3 ^12.9.0` instalado; driver síncrono.
- Schema SQL: 6 tabelas — disciplines, questions, exams, exam_questions, exam_sets, exam_set_questions.
- `src/lib/db/`: client.ts (singleton WAL+FK), schema.ts (migrate), disciplines.ts, questions.ts, exams.ts, seed.ts, index.ts.
- `src/instrumentation.ts`: migrate() roda no startup do servidor Next.js.
- `npm run seed` popula: 1 disciplina (ALP), 5 questões, 1 prova, 1 set (A) com shuffle.
- Verificado: banco criado em `data/unifil-exams.db`, seed OK, queries retornam dados corretos.
- Typecheck: limpo após Fase 2.
- next.config.ts: `serverExternalPackages: ['better-sqlite3']`.
- `tsx` instalado como devDep para scripts CLI.

## 2026-04-22 (Fases 3–7)
- **Fase 3**: UI completa — nav sidebar, layout shell, dashboard, disciplines CRUD, questions CRUD + upload imagem, auditoria. Server Actions + Server Components.
- **Fase 4**: IA — Ollama (Qwen), Claude API (`@anthropic-ai/sdk`), Gemini (`@google/generative-ai`). Página AI com `useActionState` (Client Component wrapper). Geração + revisão + salvar.
- **Fase 5**: Randomização (`buildSets`), montagem de prova com seleção de questões + sets + upload EvalBee. `createExamAction` Server Action.
- **Fase 6**: PDF via `@react-pdf/renderer` (layout 2 colunas + página EvalBee). CSV de gabarito manual. API routes `/api/pdf/[setId]` e `/api/csv/[setId]`. Página Exportações com gabarito visual.
- **Fase 7**: 11 testes — randomize (5), ai-prompt (4), csv (1). Todos passando.
- Typecheck: limpo em todas as fases.
- Configurações visíveis em `/settings`.
- `public/uploads/evalbee/` criado via `mkdir recursive` na action.

## 2026-04-22 (Verificação pós-app)
- Banco SQLite limpo antes da verificação: 5 disciplinas, 35 questões, 9 provas, 30 sets e 190 vínculos de set removidos.
- Corrigido bug de exclusão de questão usada em prova: `deleteQuestion` agora remove vínculos em `exam_set_questions` e `exam_questions` dentro de transação antes de apagar a questão.
- Validação automatizada: `npm run typecheck`, `npm run lint`, `npm test -- --run` (11 testes) e `npm run build` passaram.
- Smoke funcional direto na camada app: CRUD de disciplinas/questões, auditoria, criação de prova, randomização de 2 sets, CSV e PDF passaram.
- Smoke HTTP em `next start`: dashboard, disciplinas, questões, auditoria, IA, importação IA, provas, exportações e configurações retornaram 200.
- APIs validadas: upload de gabarito, upload de logo com restauração do arquivo original, CSV por set, PDF por prova e PDF por set.
- IA local validada via Ollama: geração simples e geração em lote retornaram questão estruturada; Claude/Gemini não foram chamados porque `.env.local` não tem API keys.
- Banco limpo novamente ao fim da sessão; arquivos de upload existentes foram preservados.

## Next Useful Inputs
- Phase split for implementation.
- Visual/UI preference for local web app.
- Exact PDF template details after structure approval.
- Decision on starting Ollama and downloading/configuring Qwen model.

## 2026-04-23
- Added SSE routes for live AI generation status: `/api/ai/generate/stream` and `/api/ai/batch/stream`.
- `/ai` and `/ai/import` now consume live status events and incremental trace updates during generation.
- Added global toast system with flash-query integration in layout for redirect-based server actions.
- Applied toast/process feedback to discipline CRUD, question CRUD/audit/delete, exam creation, file import, logo upload and gabarito upload.
- Exam assembly now supports explicit counts by type: objetivas, V/F and dissertativas.
- Added unit tests for exam type selection logic.
- Reworked PDF packing so sections try to continue in the remaining space of the current page before starting a new page.
- ESLint e Vitest agora ignoram `.claude/**` worktrees para não validar artefatos temporários do Claude junto com o repo principal.
- Validation passed: `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`.
- Release preparada como `v2.1.0` sobre `main`, com `package.json`/`package-lock.json` atualizados e `CHANGELOG.md` criado.
- Validação final de release repetida com sucesso: `npm run lint`, `npm test -- --run`, `npm run build`, `npm run typecheck`.
