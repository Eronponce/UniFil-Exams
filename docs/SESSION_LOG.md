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

## 2026-04-24

### T1 — Justificativa para questões dissertativas
- `explanation` field exposed in question form, edit page, and AI review form for all question types.
- Dissertativa uses label "Justificativa / gabarito esperado" and a distinct placeholder.
- Audit page shows the field for all types: "Gabarito esperado:" for dissertativa, "Justificativa:" otherwise; shows italic placeholder when empty.

### T2 — Justificativa visível na auditoria
- `ExplanationDisplay` component added to `src/app/audit/page.tsx`.
- Previously only objetiva/V/F showed explanation; dissertativa was excluded.

### T3 — Correção dos botões da auditoria (reload, formulário aninhado)
- Extracted `AuditPendingActions` and `AuditCardActions` as client components in `src/app/audit/_components/`.
- All buttons are `type="button"`; no nested `<form>` elements.
- `useTransition` used for non-blocking server action calls from client components.
- Two-click confirm pattern for delete (no `window.alert`).

### T4 — Downloads CSV/PDF portáveis no Linux
- `/api/csv/[setId]/route.ts` now derives filename from exam title via slug (`toLowerCase` + replace non-alphanumeric).
- Format: `gabarito-{safe-title}-set-{label}.csv`. UTF-8 BOM not added (Content-Type already specifies charset).

### T5 — Copiar para clipboard na página de importação
- Added "⎘ Copiar JSON" and "⎘ Copiar CSV" buttons in `src/app/questions/importar/import-file-client.tsx`.
- Uses `navigator.clipboard.writeText()`; button shows "Copiado!" for 2 s.
- `TEMPLATE_CSV` updated to include `explanation` column with realistic example values.

### T6 — Remover campo genérico numQuestions
- `normalizeExamSelectionRequest` no longer reads `numQuestions`.
- `pickQuestionsForExam` throws "Preencha a quantidade de questões para pelo menos um tipo..." when all type counts are zero.
- Exam creation form removed the generic total-count input.
- 3 unit tests rewritten in `src/tests/exam-selection.test.ts`.

### T7 — PDF uniforme por batch (mesma contagem de páginas)
- Two-pass PDF rendering in `src/lib/pdf/exam-pdf.tsx`.
- Pass 1: build question page list for every set → find max.
- Target = max + 1 (gabarito), rounded up to even.
- Pass 2: render each set; pad with blank pages before gabarito until target is reached.
- Gabarito is always the final page of every set.

### T8 — Fila para auditoria
- `src/lib/task-queue.ts`: module-level queue with `setImmediate`-based sequential processing; `TaskRecord` typed with `dedupKey`, `status`, `result`, `errorMessage`.
- `src/lib/actions/queue-actions.ts`: `enqueueAuditAction`, `enqueueAiGenerationAction`, `cancelTaskAction`.
- `src/instrumentation.ts` registers audit handler: calls `auditQuestion(id, value)`.
- REST API: `GET /api/queue`, `DELETE /api/queue/[taskId]`, `GET /api/queue/[taskId]/result`.
- `src/components/queue-panel.tsx`: fixed-position panel, polls every 3 s, expandable, cancel support.
- `<QueuePanel />` added to root layout.

### T9 — Fila para geração IA (background, resultado recuperável)
- `src/instrumentation.ts` registers ai-generate handler: delegates to `generateBatchQuestions`.
- `enqueueAiGenerationAction` in queue-actions.ts returns `taskId`.
- `src/app/ai/import/import-client.tsx` accepts `initialTaskId` prop; fetches result from `/api/queue/[taskId]/result` on mount.
- `src/app/ai/import/page.tsx` reads `searchParams.task` and passes it to client.
- QueuePanel "Ver" link → `/ai/import?task=[taskId]` for completed ai-generate tasks.

### T10 — Preservar dados do formulário após erros
- **Questão**: `QuestionForm` uses React 19 `useActionState`; `createQuestionAction`/`updateQuestionAction` return `{ error }` on validation failures instead of redirecting.
- **Prova**: `createExamAction` appends `title` and `institution` to redirect URL on errors; `ExamsPage` reads them as `defaultValue`.
- **IA**: form fields are controlled state; survive AI errors without reset.

### Validação final (2026-04-24)
- `npm run typecheck`: limpo (0 erros).
- `npm run lint`: limpo (0 warnings).
- `npm test -- --run`: 33 testes passando (5 arquivos).
- `npm run build`: sucesso, 28 rotas compiladas.

## 2026-04-24 — Fechamento dos pontos parciais T1-T11

### Complementos de implementacao
- `/ai` agora enfileira geracao individual via `ai-generate-single`; resultado recupera em `/ai?task=[taskId]`.
- `/ai/import` agora usa fila como fluxo primario para lotes; o botao de streaming direto saiu da UX principal.
- `QueuePanel` mostra link "Ver" para lote e para geracao individual concluida.
- Formulario de prova preserva `quantitySets`, `numObjetivas`, `numVF` e `numDissertativas` em redirecionamentos de erro.
- Tela `/questions/importar` agora exibe campos read-only com sintaxe JSON e CSV copiavel.
- `/api/pdf/[setId]` passou a renderizar apenas o set solicitado, mantendo o tamanho uniforme calculado pelo lote inteiro.
- CSV de gabarito agora tem cabecalho coerente com tres colunas: `Questão`, `Resposta`, `Enunciado`.

### Documentacao Obsidian
- Nova nota [[PROMPT_T1_T11_STATUS]] registra cobertura T1-T11, fila, PDF, JSON/CSV e validacao.
- Nova nota [[OBSIDIAN_GITHUB]] define o que deve ir ao GitHub e o que fica local.
- [[INDEX]], [[AI_GENERATION]], [[EXPORTS_EVALBEE]], [[SCREEN_MAP]], [[DECISIONS]], [[TODO]] e README foram atualizados para refletir o estado final.

### Validacao final do fechamento
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm test -- --run`: passou, 36 testes em 6 arquivos.
- `npm run build`: passou, 28 rotas app listadas.

## 2026-04-24 — Correção operacional da fila

### Problema observado
- Usuario clicou para auditar; tarefa ficou na fila mas a questao nao foi auditada.
- Usuario enfileirou IA; mensagem mencionava painel, mas o painel nao estava evidente/visivel.
- Expectativa: navegar entre telas enquanto auditoria/IA processam em background e atualizar a tela quando a tarefa termina.

### Causa provavel
- `src/lib/task-queue.ts` usava estado module-level comum (`const queue = []`).
- Em Next.js, Server Actions e Route Handlers podem carregar instancias separadas do modulo, deixando a tarefa invisivel para `/api/queue` e para o painel.

### Correção
- Fila movida para `globalThis.__UNIFIL_EXAMS_TASK_QUEUE__`.
- Handlers padrao movidos para `src/lib/task-handlers.ts` e registrados de forma preguiçosa em actions, API e instrumentation.
- `/api/queue/[taskId]` agora tem `GET` para status individual.
- `QueuePanel` fica sempre visivel no rodape, inicia aberto, faz polling a cada 1 s e chama `router.refresh()` quando tarefa termina.
- `/ai` e `/ai/import` fazem polling do task ativo e carregam resultado automaticamente quando fica pronto.

## 2026-04-24 — Persistência de estado entre telas

### Plano Obsidian
- Criada nota [[WORKSPACE_STATE_PLAN]] para documentar objetivo, arquitetura, fases, riscos e critérios de aceite.
- Decisão registrada em [[DECISIONS]]: o equivalente de Pinia no projeto é Zustand com middleware `persist`.

### Implementação
- Dependência `zustand` instalada.
- `src/lib/state/workspace-store.ts` criado com slices para IA individual, importação em lote, montagem de prova e rascunhos futuros de questões.
- `/ai` preserva disciplina, provedor, tipo, modelo Ollama, tópico e `queuedTaskId`.
- `/ai/import` preserva disciplina, provedor, tipo, modelo Ollama, texto bruto e `queuedTaskId`.
- `/exams` usa `ExamDraftFields` client-side para preservar título, instituição, sets e quantidades por tipo.

### Pendente consciente
- `/questions/new` ainda não foi conectado ao store. O shape existe, mas precisa cuidado para não persistir uploads/imagens.
- 
## 2026-04-27 â€” Ajuste visual do gabarito e distribuicao vertical do PDF

### PDF / exportacao
- `exams.answer_key_width_pt` adicionado ao schema com migracao e default `350`.
- `Exam.answerKeyWidthPt` agora e persistido no model e usado pelo renderer do PDF.
- Gabarito deixou de usar largura fixa total; largura e configuravel por prova.
- Paginas de questoes em 2 colunas agora aplicam `justifyContent: space-between` apenas no ultimo bloco da pagina quando nao ha gabarito inline, reduzindo o vazio no rodape sem roubar espaco do gabarito embutido.

### Interface
- `GabaritoUpload` ganhou slider de tamanho em `pt`, persistencia automatica e previa proporcional a pagina A4.
- `GET /api/upload/gabarito/[examId]` passou a retornar `widthPt` junto do status/URL do arquivo.
- `PUT /api/upload/gabarito/[examId]` salva o tamanho do gabarito.
- Upload do gabarito agora remove extensoes antigas (`png/jpg/jpeg`) antes de salvar a nova imagem.

### Validacao
- `npm run typecheck`: passou.
- `npm test -- --run`: passou, 53 testes.
- `npm run build`: passou.
- `npm run lint`: sem erros; ficaram 2 warnings preexistentes fora deste escopo (`questions-table.tsx` e `pdf-balance.test.ts`).

## 2026-04-27 - Migracao da exportacao para HTML paginado A4

### Arquitetura
- `react-pdf` saiu do fluxo oficial de exportacao; provas agora abrem em paginas HTML standalone de impressao em `/print/exam/[examId]` e `/print/set/[setId]`.
- O App Router foi dividido em dois grupos: `(app)` com shell normal e `(print)` com layout minimo para impressao.
- `/api/pdf/[setId]` e `/api/pdf/exam/[examId]` agora respondem com redirect `307` para as novas rotas `/print/*`.

### Renderizacao e paginacao
- `src/lib/print/pagination.ts` implementa paginacao sequencial real: coluna esquerda, coluna direita, proxima pagina; sem balanceamento artificial.
- `src/components/print/exam-print-client.tsx` mede blocos reais no DOM apos `document.fonts.ready` e apos carga das imagens.
- Questoes com tabela ou bloco largo sobem para `full-width`; dissertativas ficam em largura total com linhas HTML.
- O gabarito continua usando `answerKeyWidthPt`, mas agora fica preso ao rodape da ultima pagina e a pagina final reserva essa area antes da distribuicao das ultimas questoes.
- Sets menores continuam sendo preenchidos com paginas em branco antes da ultima pagina para manter contagem uniforme e arredondada para par.

### HTML sanitizado
- `questions.statement` passou a ser tratado como HTML sanitizado no app inteiro.
- `src/lib/html/rich-text.ts` centraliza sanitizacao, extracao de texto puro e deteccao de tabelas.
- `MarkdownText` virou wrapper de HTML sanitizado para preservar chamadas existentes sem markdown.

### Validacao
- `npm test -- --run`: passou, 52 testes.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build`: passou.

## 2026-04-28 - Ajustes finais de exportacao e preparo do release v2.3.0

### Exportacoes
- `Gabarito Completo` em `/exports` passou a focar apenas a prova selecionada em vez de agregar questoes de todas as provas.
- O enunciado nessa secao agora usa HTML sanitizado rico, preservando `strong`, listas, marcas e tabelas.
- Imagens das questoes foram expostas tambem no `Gabarito Completo`, alinhadas ao card de resposta correta e justificativa.

### Release
- `package.json` e `package-lock.json` foram preparados para `v2.3.0`.
- `CHANGELOG.md` recebeu entrada nova para a release `2.3.0`.
