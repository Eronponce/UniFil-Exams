# Session Log

## 2026-08-12 - Documentação consolidada de produto e backup

- Criado [[IMPLEMENTATION_HISTORY_2026-08]] com as implementações de montagem, paginação, versões, inativação, importação, rastreabilidade, `True/False`, PNG comentado e backup amplo.
- [[EXPORTS_EVALBEE]] foi corrigido para refletir `True`/`False` e exportações históricas versionadas.
- [[BACKUP_GOOGLE_DRIVE]] foi marcado como pacote legado substituído por [[SERVER_ALL_SYSTEMS_BACKUP]].
- O runbook e a memória persistente agora registram a decisão explícita de manter uma cópia da senha Restic em texto puro no mesmo Drive, além das cópias no servidor e no Windows.
- O incidente Netdata de swap foi documentado com causa raiz, limites de contenção, correção do wrapper recursivo e evidência da restauração real.

## 2026-08-12 - Backup diário criptografado de todos os sistemas

### Cobertura e arquitetura

- Inventariados os containers, bind mounts, volumes nomeados e bancos persistentes do Dell remoto.
- Implementado Restic criptografado e deduplicado sobre o remote rclone `unifil-drive:Servidor-Eron/backup-restic`.
- Incluídos UniFil Exams, Canva API, Eron Dashboard, Mirror legado, os volumes ativo e histórico do Grade App, as duas cópias host do Grade, todos os bancos conectáveis do Supabase (`postgres` e `_supabase`), storage/functions/snippets e configurações necessárias para recuperação.
- Segredos entram somente por allowlist explícita dentro do snapshot criptografado; `rclone.conf` e a senha Restic são excluídos.
- Retenção configurada em 14 diários, 8 semanais e 12 mensais, com prune inicialmente desativado.

### Operação e segurança

- Instalados `rclone` e `restic` em `~/.local/bin`, sem alteração global de pacotes.
- OAuth do Google Drive validado; pasta remota criada e configuração protegida com modo `0600`.
- Instalado timer systemd do usuário para 03:30 `America/Sao_Paulo`, persistente, com atraso aleatório de até 10 minutos; `linger` ativado para funcionar sem sessão SSH.
- Senha Restic gerada com modo `0600`; cópia de recuperação conferida por SHA-256 em `C:\Users\eronp\Documents\UniFil-Backup-Recovery\restic-password.txt`, fora do Google Drive e com ACL restrita ao usuário/SYSTEM.
- O cron local PostgreSQL anterior foi preservado como camada adicional durante a adoção inicial.

### Evidência

- Os três harnesses Bash passaram localmente e no Ubuntu remoto.
- Dry-run contra dados vivos passou, incluindo 9 SQLite, 2 dumps PostgreSQL e as áreas de arquivos/configuração, sem helper ou staging residual.
- Primeiro snapshot remoto concluído: `613b2855f385a0551a4934d67088eb9f1a34e0a5c1d5d1759cee406a6c58b033`.
- `check-backup-health.sh` confirmou `STATUS: healthy` e o snapshot remoto mais recente.
- A verificação de restauração foi retomada após restabelecer o host e concluída com sucesso; detalhes e correção de regressão registrados ao fim deste log.

## 2026-08-11

- Added the persisted per-exam `allowQuestionSplit` preference with a Portuguese controlled checkbox and validation-redirect preservation.
- Added opt-in JS-measured objective fragments that keep statement/image plus whole alternatives in the first fragment and render compact continuation markers in the next column/page.
- Verified focused split/persistence/form coverage: 3 files, 23 tests passed; typecheck and lint passed.
- Added a high-resolution “PNG comentado” download per set on `/exports`, containing the exact displayed answer and each question's justification.
- PNG generation supports immutable historical versions, uses `True`/`False` for V/F, and visually identifies set, version, position and source bank ID.
- Validation: synthetic visual render inspected; 26 test files/140 tests, typecheck, lint and production build passed. The pre-existing NFT warning remains unchanged.

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

## 2026-04-28 - Prompts de IA unificados + chat de issue para GitHub

### IA / rich text
- `src/lib/ai/prompt-templates.ts` passou a centralizar os prompts-base de importacao, geracao unitara e geracao em lote.
- Todos os fluxos de IA agora documentam o mesmo contrato de campos e o mesmo suporte a HTML sanitizado em `statement`.
- `/ai` e `/ai/import` ganharam bloco visual com o prompt padrao efetivo e botao para copiar.
- A revisao manual em `/ai` agora deixa explicito que o enunciado aceita HTML sanitizado e respeita a dificuldade retornada pela IA.
- `/audit` ganhou lembrete visual sobre o suporte a HTML sanitizado nos enunciados.

### GitHub issues
- `src/lib/github/issues.ts` descobre o repo por `GITHUB_ISSUES_REPO`, `GITHUB_REPOSITORY` ou `git origin`.
- `src/components/issue-chat-panel.tsx` agora abre um rascunho de issue no GitHub com titulo/corpo preenchidos; se o usuario nao estiver logado, o proprio GitHub pede login antes do envio final.
- O painel de fila foi encaixado no mesmo dock flutuante do chat.

### Configuracao e validacao
- `.env.local.example` ficou sem token obrigatorio; mantem apenas `GITHUB_ISSUES_REPO` e `GITHUB_ISSUES_LABELS` como overrides opcionais.
- `src/app/layout.tsx` passou a usar `public/unifil-logo.jpg` como favicon/app icon.
- Validado com `npm run typecheck`, `npm run lint`, `npm test -- --run src/tests/ai-prompt.test.ts src/tests/github-issues.test.ts` e `npm run build`.

## 2026-04-28 - Gabarito inline no fim da ultima pagina quando couber

### Renderizacao
- `ExamPrintClient` agora mede a altura real do gabarito e tenta reservar essa area no rodape da ultima pagina de questoes.
- Quando o set consegue manter a mesma contagem de paginas dentro do alvo uniforme do lote, o gabarito fica inline nessa ultima pagina.
- Se o inline quebrar o alvo uniforme, o renderer mantem o fallback antigo: paginas em branco antes de uma pagina final exclusiva do gabarito.

### Validacao
- Testes unitarios da regra de total de paginas ganharam cobertura para inline vs. pagina separada por lote.

## 2026-04-29 - Release v2.4.0 em Docker com base limpa

### Docker / runtime
- Confirmado que `HEAD` local coincide exatamente com a tag `v2.4.0`.
- Adicionados `.dockerignore`, `Dockerfile` e `compose.yml` na raiz para build/producao local com `next build` + `next start`.
- Volumes bind configurados para `data/`, `public/uploads/` e `public/gabaritos/`.
- `OLLAMA_BASE_URL` no container ficou padronizado para `http://host.docker.internal:11434`.

### Limpeza e validacao
- `docker compose down` executado antes da limpeza.
- Banco SQLite removido em `data/unifil-exams.db*` e recriado automaticamente no boot da app.
- `docker compose up --build -d` validado com sucesso.
- Container `unifil-exams-release` subiu em `0.0.0.0:3000`.
- `docker compose logs` mostrou `next start` pronto; smoke HTTP em `http://localhost:3000` retornou `200`.

## 2026-04-29 - Patch release v2.4.1 para fila de auditoria

### Causa raiz
- A auditoria em fila concluia rapido demais para o refresh depender apenas do `QueuePanel`.
- O botao de auditoria ficava preso no estado client-side `Na fila...`, mesmo quando a task ja tinha encerrado.

### Correcao
- `src/app/(app)/audit/_components/use-audit-queue-task.ts` adicionado para observar o `taskId` da propria auditoria e chamar `router.refresh()` quando a task chega a estado terminal.
- `audit-pending-actions.tsx` e `audit-card-actions.tsx` agora usam esse polling local em vez de depender apenas do painel global.
- `src/components/queue-panel.tsx` manteve o ajuste para refresh de tasks rapidas vistas pela primeira vez ja em estado terminal.

### Release
- `package.json` e `package-lock.json` atualizados para `v2.4.1`.
- `CHANGELOG.md` ganhou entrada `2.4.1`.

## 2026-05-12 - Tabelas em dissertativas: meia largura com fallback legivel

### Renderizacao / paginacao
- `src/components/print/exam-print-client.tsx` agora mede tabela de enunciado dissertativo em largura intrinseca e decide layout por escala minima legivel.
- Nova regra: tenta manter a questao em coluna (meia pagina) reduzindo tabela; quando a escala exigida ficaria abaixo do limite, volta para `full-width`.
- A preferencia de render por questao (escala + modo adaptativo) passou a ser carregada no estado de render para manter medicao e render final alinhados.

### CSS de impressao
- `src/app/globals.css` ganhou regras `exam-print-question--adaptive-table` com `--essay-table-scale` para reduzir fonte/padding da tabela sem afetar o resto da prova.
- O modo de medicao da coluna (`exam-print-measure-box--column`) usa largura intrinseca da tabela (`max-content`) so para calcular necessidade real de escala.

### Validacao
- Novo teste unitario: `src/tests/table-layout.test.ts`.
- Validado com `npm test -- --run`, `npm run typecheck` e `npm run lint`.

## 2026-05-12 - Ajuste de hidratacao + fluxo de preview

### Correcao de hidratacao
- `src/app/layout.tsx` agora aplica `suppressHydrationWarning` tambem no `<body>`.
- Objetivo: ignorar divergencias de atributos injetados por extensoes de navegador antes da hidratacao (ex.: Grammarly).

### Fluxo de preview
- `src/app/(app)/exports/page.tsx`: `Abrir Preview` deixou de usar `target="_blank"`; agora abre na mesma aba.
- `src/components/print/exam-print-client.tsx`: link `Voltar` para `/exports` passou a usar `replace` para evitar poluicao do historico/navegacao com copias.

### Validacao
- `npm run typecheck`: passou.
- `npm run lint`: passou.

## 2026-05-13 - Preview de gabarito/logo no Docker via rotas de arquivo

### Causa raiz
- Em runtime Docker (Next.js 16 + Turbopack production), caminhos estaticos em `public` (`/gabaritos/...` e `/unifil-logo.*`) estavam inconsistentes para preview/logo, gerando `404/500` no browser.
- O upload de logo pode trocar extensao (`.jpg`, `.jpeg`, `.png`), enquanto a metadata estava fixa em `/unifil-logo.jpg`.

### Correcao
- Nova rota de arquivo do gabarito: `src/app/api/upload/gabarito/[examId]/file/route.ts`.
- Nova rota de arquivo da logo: `src/app/api/upload/logo/file/route.ts`.
- `src/app/api/upload/gabarito/[examId]/route.ts` agora retorna URL da rota de arquivo com cache-busting por `mtime`.
- `src/lib/print/build-print-payload.ts` passou a usar rotas API para `logoUrl` e `answerKeyUrl`.
- `src/app/layout.tsx` metadata de icones agora aponta para `/api/upload/logo/file`.

### Validacao
- Rebuild Docker: `docker compose up --build -d`.
- `GET /api/upload/gabarito/3/file`: `200 image/jpeg`.
- `GET /api/upload/logo/file`: `200 image/jpeg`.
- `GET /api/upload/gabarito/3`: URL de preview retornada corretamente com `?v=...`.

## 2026-05-13 - Favicon atualizado para marca enviada

### UI / branding
- Novo favicon da app salvo em `public/favicon-unifil.png` (origem: `10983643.png`).
- `src/app/layout.tsx` passou a usar esse arquivo em `metadata.icons` (`icon`, `shortcut`, `apple`).

### Validacao
- `GET /favicon-unifil.png`: `200 image/png` no container Docker.

## 2026-05-12 - UI otimista na auditoria

### UX
- Ao clicar em `✓ Auditar` ou `Des-auditar`, o card agora some instantaneamente (otimista), antes do refresh do servidor.
- Em caso de falha da action, o card reaparece (rollback).

### Implementacao
- Novo contexto cliente: `src/app/(app)/audit/_components/audit-optimistic-context.tsx`.
- `src/app/(app)/audit/page.tsx` passou a envolver a tela com `AuditOptimisticProvider` e usar `AuditOptimisticCard` em cards pendentes/auditados.
- `src/app/(app)/audit/_components/audit-pending-actions.tsx` e `audit-card-actions.tsx` agora chamam `hideQuestion/showQuestion` no fluxo otimista.

### Validacao
- `npm run typecheck`: passou.
- `npm run lint`: passou.

## 2026-05-12 - Auditoria direta sem fila para reduzir latencia

### Causa percebida
- A auditoria usava fila global + polling + `router.refresh()` ao concluir task.
- Em maquinas locais, o fluxo parecia lento mesmo com `UPDATE` rapido no banco.

### Correcao
- `src/lib/actions/questions.ts` ganhou `setQuestionAuditedAction(id, audited)` para atualizar auditoria de forma direta.
- `src/app/(app)/audit/_components/audit-pending-actions.tsx` trocou `enqueueAuditAction` por `setQuestionAuditedAction`.
- `src/app/(app)/audit/_components/audit-card-actions.tsx` trocou `enqueueAuditAction` por `setQuestionAuditedAction`.
- O estado `Na fila...` saiu dos botoes de auditoria/des-auditoria; agora a acao executa direta e faz refresh ao concluir.

### Validacao
- `npm run typecheck`: passou.
- `npm run lint`: passou.

## 2026-05-12 - Tabelas adaptativas para qualquer tipo de questao

### Causa raiz
- As questoes com `<table>` no banco atual estavam em `question_type = objetiva`.
- A regra adaptativa anterior rodava so para dissertativa com tabela, mantendo objetivas com tabela em `full-width`.

### Correcao
- `src/components/print/exam-print-client.tsx` agora aplica a decisao adaptativa (coluna vs full) para qualquer questao com tabela.
- A deteccao de `full-width` deixou de forcar tabela por tipo; agora usa decisao por escala minima e overflow real.
- `src/lib/print/table-layout.ts` reduziu escala minima de legibilidade de `0.72` para `0.58` para priorizar meia largura antes do fallback.

### Validacao
- `npm test -- --run src/tests/table-layout.test.ts src/tests/pdf-balance.test.ts src/tests/pdf-pages.test.ts`: passou.
- `npm run typecheck`: passou.
- `npm run lint`: passou.

## 2026-05-12 - Botao de issue reduzido e reposicionado no dock

### UI
- `src/components/issue-chat-panel.tsx` agora usa FAB circular pequeno (`GH`) em vez de botao largo.
- O chat de issue abre como popover absoluto acima do FAB, sem empurrar/ocupar area do painel de tarefas.
- `src/app/(app)/layout.tsx` ajustou o dock fixo para alinhar elementos a direita e manter o painel de tarefas em largura total.

### Validacao
- `npm run typecheck`: passou.
- `npm run lint`: passou.

## 2026-06-08 - Questao V/F impressa sem linha Verdadeiro/Falso

### Ajuste
- `src/components/print/exam-print-client.tsx` deixou de renderizar a linha com caixas e labels `Verdadeiro`/`Falso` nas questoes `verdadeiro_falso`.
- A prova impressa/preview agora mostra apenas o enunciado da afirmacao, mantendo banco, randomizacao e gabarito inalterados.

### Validacao
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm test -- --run src/tests/pdf-pages.test.ts src/tests/pdf-balance.test.ts`: passou.
- Smoke visual em `http://localhost:3000/print/exam/4`: abriu; `document.querySelector('.exam-print-vf-row') === null`; preview sem ocorrencias de `Verdadeiro`/`Falso`.

## 2026-06-08 - Gabarito de dissertativa usa `-`

### Ajuste
- `src/lib/pdf/exam-csv.ts` trocou o placeholder de resposta de questoes `dissertativa` de `Dissertativa` para `-` no CSV.
- `src/app/(app)/exports/page.tsx` trocou o resumo rapido por set de `D` para `-` para manter consistencia visual com o CSV.

### Validacao
- `npm test -- --run src/tests/csv.test.ts`: passou.
- `npm run typecheck`: passou.
- `npm run lint`: passou.

## 2026-06-08 - Release v2.4.5

### Empacotamento
- `package.json` atualizado para `2.4.5`.
- `package-lock.json` sincronizado para `2.4.5` (estava atrasado em `2.4.3`).
- `CHANGELOG.md` ganhou entrada `2.4.5`.

### Validacao
- `npm test`: passou (`12` arquivos, `70` testes).
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `docker compose down`: passou.
- `docker compose up --build -d`: bloqueado por rede do ambiente Docker; `npm ci` no container falhou com multiplos `ECONNRESET` ao baixar tarballs de `registry.npmjs.org`, impedindo a validacao local da release em Compose.

## 2026-08-03 - Imagens de questao no runtime Docker e exclusao de provas

### Diagnostico e correcao
- A instancia usada pelo app e o container `unifil-exams-release` no host `100.92.163.25`, construido em `/home/eronp/UniFil-Exams`.
- O volume `/home/eronp/UniFil-Exams/public/uploads` esta montado em `/app/public/uploads`; os arquivos das questoes existiam no container, mas `/uploads/questions/<arquivo>` retornava `404` no `next start`.
- Foi criada a rota dinamica `src/app/uploads/questions/[filename]/route.ts`, com validacao de nome/extensao e leitura segura do arquivo. Os caminhos antigos gravados no banco continuam validos.
- Foi implementada `deleteExam`/`deleteExamAction`, com confirmacao na tela de montagem, exclusao transacional de prova, sets e tabelas de relacionamento, preservacao das questoes e limpeza do gabarito por ID.
- A instalacao do Chromium e `UNIFIL_PDF_BROWSER=/usr/bin/chromium`, antes mantidas apenas no Dockerfile remoto, foram incorporadas ao Dockerfile versionado.

### Validacao
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm test -- --run`: passou (`12` arquivos, `70` testes).
- Build remoto Docker: passou; rota `/uploads/questions/[filename]` incluida no build.
- Preview remoto da prova 14: 12 questoes, 36 tags de imagem medidas, 36/36 carregadas com dimensoes validas.
- PDF direto `/api/pdf/exam/14`: HTTP 200, 326950 bytes.
- Prova temporaria 15 criada, excluida pela Server Action e removida da lista; provas 12, 13 e 14 permaneceram.

## 2026-08-04 - Workspace acadêmico responsivo

### Interface
- Implementado shell responsivo em `src/app/(app)/layout.tsx`: sidebar desktop recolhível, drawer móvel, skip link, main landmark, tema persistente e dock de atividade.
- Navegação agrupada em Visão geral, Conteúdo, Criar, Avaliações e Sistema; ativos têm estado visual e `aria-current`.
- Criada paleta de comandos global (`Ctrl/Cmd + K`) com busca, grupos, ações de criação, foco inicial, `Esc`, setas e `Enter`.
- Criado sistema visual compartilhado em `src/components/ui.tsx` e `src/components/icon.tsx`, sem dependência adicional de ícones.
- Dashboard passou a ser centro de comando com KPIs, prontidão por disciplina, continuidade, atenção recente e avaliações recentes.
- Headers, estados vazios e layouts responsivos aplicados às telas de disciplinas, banco, auditoria, IA, importação, montagem e exportação.
- `QueuePanel` e `IssueChatPanel` foram encaixados no mesmo dock e tiveram apenas a apresentação modernizada; polling, cancelamento, links de resultado e integração GitHub foram preservados.
- `globals.css` ganhou tokens claro/escuro/sistema, acessibilidade, reduced motion, overflow de tabelas e isolamento explícito do print A4.

### Documentação e estado
- [[SCREEN_MAP]] e [[USER_WORKFLOWS]] atualizados para a nova arquitetura `ORGANIZAR → REVISAR → CRIAR → ENTREGAR`.
- [[DECISIONS]] recebeu a decisão estável do sistema visual.
- `.agents/project-memory.md` criado neste checkout, que não possuía memória persistente.

### Validação
- `rtk npm run typecheck`: passou.
- `rtk npm run lint`: passou.
- `rtk npm test -- --run`: 16 arquivos, 82 testes passando.
- `rtk npm run build`: passou; rotas app/API/print listadas. Permaneceu apenas o warning não fatal de NFT tracing da rota de imagem runtime.
- `rtk playwright test`: bloqueado pelo repositório sem `playwright.config.*`; Playwright 1.62.1 auto-descobriu os testes Vitest, falhou ao importar Vitest em CommonJS e terminou com `No tests found` (0 pass/0 fail). Nenhuma dependência ou configuração foi adicionada; build e testes Vitest foram usados como fallback.

## 2026-08-04 - Navegação na visualização e imagem grande na edição

- A visualização individual de questão passou a oferecer `Anterior` e `Próxima`, usando a mesma ordem por disciplina já aplicada na edição.
- Na edição, a imagem atual agora aparece em preview grande e responsivo logo após o enunciado.
- O campo inferior de arquivo ficou dedicado apenas a substituir a imagem existente.
- Validado com `npm run typecheck`, `npm run lint`, `npm test -- --run src/tests/questions-behavior.test.ts` e `npm run build`.

## 2026-08-04 - Área temática coletiva no banco de questões

- A barra de seleção do banco ganhou a ação `Definir área temática`.
- Uma única área pode ser aplicada transacionalmente a todas as questões selecionadas sem alterar seus enunciados.
- O campo sugere áreas existentes; quando enviado vazio, remove a área temática da seleção.
- O editor detalhado anterior foi preservado em `Editar conteúdo`.
- Validado com `npm run typecheck`, `npm run lint` e 11 testes focados.

## 2026-08-04 - Set A como ordem padrão da exportação

- O `Gabarito Completo` passou a numerar e exibir as questões na ordem explícita do Set A.
- A ordem não depende mais da sequência incidental dos sets retornados pelo SQLite.
- PDFs e CSVs individuais continuam respeitando o embaralhamento próprio de cada set.
- Provas antigas sem Set A usam o primeiro rótulo disponível como fallback determinístico.

## 2026-08-05 - Alternativas do gabarito completo iguais ao Set A

- Corrigida a divergência em que o gabarito rápido indicava, por exemplo, `Q1→D`, mas o completo mostrava as alternativas originais e marcava `A`.
- O gabarito completo agora reproduz tanto a sequência das questões quanto o embaralhamento das alternativas objetivas do Set A.
- A alternativa correta é destacada usando a letra efetivamente impressa no Set A.
- Embaralhamentos inválidos ou ausentes usam a ordem original como fallback seguro.

## 2026-08-06 - Reabertura da sidebar recolhida

- Corrigido o CSS que escondia o próprio botão `Expandir menu lateral` quando `sidebarCollapsed` estava ativo.
- O botão permanece visível no trilho compacto e o espaçamento foi ajustado para manter a área clicável dentro dos 82px.
- Preferência persistida de sidebar continua funcionando; mobile mantém o layout expandido do drawer.
- Validado com typecheck, lint, teste do app shell e build de produção.

## 2026-08-10 - Layout por tipo e campos de resposta na prova impressa

- A montagem de prova passou a persistir largura `column`/`full` independentemente para objetiva, V/F, numérica e dissertativa; provas anteriores recebem defaults compatíveis.
- Mudanças de disciplina ou área removem quantidades antigas da URL e sincronizam todos os quatro campos com o pool auditado atual, inclusive `0`; switches de largura permanecem inalterados.
- A impressão agora respeita o layout salvo para cada tipo, mantém tabelas contidas nessa largura, renderiza V/F com escolhas desmarcadas, numérica com campo rotulado e não cria linhas para dissertativa com `answerLines=0`.

## 2026-08-11 - Prompt de importação e mapa de rastreabilidade

- `buildImportPrompt()` passou a refletir integralmente o prompt-fonte anexado, mantendo a estrutura `{version, exportedAt, questions:[...]}` e os nove campos exatos por questão; o fallback duplicado do client foi removido.
- Criado `buildExamTraceCsv()` e a rota `/api/csv/exam/[examId]/trace`, com uma linha por questão impressa em cada set, resposta após embaralhamento, ordem original e ID da questão; questão ausente continua registrada.
- `/exports` ganhou o botão “Mapa de rastreabilidade” e a explicação curta do cruzamento EvalBee ↔ banco.
- Validação focada inicial foi bloqueada por ausência de dependências; o junction local para `node_modules` foi criado depois, sem instalação ou acesso externo.

## 2026-08-11 - Assunto no prompt de importação

- O importador ganhou o campo “Assunto/tema das questões”; o valor é inserido no prompt como `ASSUNTO/TEMA DA PROVA` e referenciado em todas as regras de escopo.
- O prompt incorporou estrutura/densidade de enunciado, teste do contexto, dificuldade por raciocínio, fidelidade a materiais e controle de pistas nos distratores.
- JSON foi documentado como formato preferencial para LLMs; CSV permanece indicado para edição tabular.
- Validação: 20 arquivos, 116 testes; typecheck, lint e build passaram.

## 2026-08-11 - Quantidades e template completo no prompt

- O importador ganhou quatro campos de quantidade: objetivas, verdadeiro/falso, numéricas e dissertativas; `0` desativa o tipo.
- O prompt copiado agora inclui essas metas e termina com o JSON completo de exemplo contendo os quatro tipos, sem adicionar campos ao contrato de importação.
- Validação: 20 arquivos, 118 testes; typecheck, lint e build passaram.

## 2026-08-12 - Primeiro backup amplo e restauração verificada

- Primeiro snapshot Restic no Google Drive concluído: `613b2855f385a0551a4934d67088eb9f1a34e0a5c1d5d1759cee406a6c58b033`.
- O teste real encontrou recursão no wrapper do verificador quando `RESTIC_BIN` era o nome simples `restic`; o wrapper foi renomeado para `run_restic` e ganhou teste de regressão específico.
- A validação restaurou `metadata/` e `databases/` em diretório temporário, sem alterar dados vivos: 15 checksums, 9 SQLite com `PRAGMA integrity_check`, 2 dumps PostgreSQL com `pg_restore --list` e `globals.sql` não vazio.
- A restauração temporária transferiu 986,932 MiB; a execução corrigida teve pico de 295,6 MiB e zero swap. O diretório temporário foi removido automaticamente.
- Um rate limit transitório do Google Drive foi recuperado automaticamente pelo rclone; o teste terminou com sucesso.
- O timer `server-all-systems-backup.timer` permanece ativo para execução diária às 03:30 em `America/Sao_Paulo`, com atraso aleatório de até 10 minutos.
