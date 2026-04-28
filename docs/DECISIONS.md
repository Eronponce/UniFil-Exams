# Decisions

Use this file for durable project decisions. Keep entries short and factual.

## 2026-04-22 - Start With Stack-Agnostic Scaffold
- Decision: create documentation and agent context before choosing runtime stack.
- Reason: repository is empty and product scope is not defined yet.
- Impact: avoids early migration cost and keeps next decisions explicit.

## 2026-04-22 - Markdown Knowledge Base
- Decision: use markdown docs as the local knowledge base.
- Reason: compatible with Git, Obsidian-style navigation, and AI session continuity.
- Impact: project context should be updated in `docs/` and `.agents/project-memory.md` when facts become stable.

## 2026-04-22 - RTK Required For Shell Work
- Decision: RTK is installed and should be used explicitly for shell commands.
- Reason: user requires RTK always; native Windows/Codex does not provide automatic hook rewriting here.
- Impact: use commands like `rtk git status`, `rtk read <file>`, and `rtk grep <pattern> .`; use `rtk proxy <cmd>` only when raw output is needed.

## 2026-04-22 - Product Scope: Objective Exam Builder
- Decision: build a local app for objective question banks, auditing, AI generation, exam assembly, randomized sets, PDF export, and answer key CSV.
- Reason: user defined scope around replacing manual exam creation and review.
- Impact: online student exam-taking and automatic correction are out of scope for V1.

## 2026-04-22 - V1 Platform Direction
- Decision: plan V1 as a local web app using Next.js, TypeScript, and SQLite.
- Reason: supports CRUD, local data, printable UI, PDF generation, and future evolution without choosing desktop packaging now.
- Impact: no login or multiuser flow in V1.

## 2026-04-22 - AI Provider Direction
- Decision: user chooses AI provider per generation: local Qwen3.5 9B Q4_K_M, Claude API, or Gemini API.
- Reason: user wants local Qwen for exams and external APIs as options.
- Impact: generated questions require validation and human audit before saving.

## 2026-04-22 - Fase 2: SQLite Driver
- Decision: `better-sqlite3` (síncrono) sem ORM. Queries manuais com TypeScript tipado.
- Reason: app local de complexidade moderada; sem ORM = sem abstração, mais simples de debugar.
- Impact: options de questão armazenadas como JSON; shuffled_options de set armazenado como JSON. Schema com `CREATE TABLE IF NOT EXISTS` (idempotente para V1).

## 2026-04-22 - Fase 1: Test Runner e Formatter
- Decision: Vitest + Testing Library para testes; Prettier para formatação.
- Reason: Vitest é mais rápido e melhor integrado com Vite/Next.js que Jest; Prettier é padrão da comunidade TS.
- Impact: `npm test` roda Vitest; `npm run typecheck` roda tsc; ESLint flat config via `eslint.config.mjs`.

## 2026-04-22 - EvalBee Export Model
- Decision: each exam set accepts its own EvalBee image and places it on the last PDF page.
- Reason: user marks/prepares the EvalBee sheet externally and uses EvalBee for correction.
- Impact: app does not auto-mark EvalBee circles in V1; it still exports CSV answer keys by set.

## 2026-04-23 - Global Process Feedback
- Decision: standardize user feedback with global toasts plus URL-flash toasts for server-action redirects.
- Reason: the user needs visibility into success and error states across the whole system, not only inside the current form.
- Impact: create/update/delete/audit/upload/import/exam creation now expose consistent feedback states.

## 2026-04-23 - AI Generation Observability
- Decision: expose AI generation and batch import progress through SSE routes with incremental status and trace updates.
- Reason: the user wants to understand where generation failed while the process is still running.
- Impact: `/ai` and `/ai/import` now consume live events and show evolving trace data before completion.

## 2026-04-23 - Exam Composition By Question Type
- Decision: exam assembly accepts explicit counts for `objetiva`, `verdadeiro_falso`, and `dissertativa`.
- Reason: teachers need deterministic section composition even when the audited pool is much larger than the final exam.
- Impact: per-type counts take precedence over generic total question count when provided.

## 2026-04-23 - Continuous PDF Section Packing
- Decision: PDF sections should try to reuse the remaining vertical space on the current page before opening a new page.
- Reason: forced page starts between sections wasted space and produced awkward breaks.
- Impact: the renderer now packs section chunks sequentially per page instead of allocating a fresh page per section.

## 2026-04-24 - Uniform PDF Page Count Per Batch
- Decision: two-pass PDF rendering to ensure all sets in a batch have the same (even) page count; shorter sets are padded with blank pages before the gabarito.
- Reason: when printing a batch of exam sets, every set must land on the same number of sheets so fronts and backs align correctly and the gabarito is always the true last page.
- Impact: `prepareSetSections` runs for all sets to find max question-page count; target = max + 1 (gabarito), rounded up to even; blank pages inserted before gabarito as needed.

## 2026-04-24 - In-Memory Task Queue (Audit + AI)
- Decision: introduce a module-level in-memory queue (`src/lib/task-queue.ts`) for audit and AI-generate operations; queue persists across page navigations (same Node.js process) but not across server restarts.
- Reason: audit operations were blocking the UI on each click; AI generation needed a fire-and-forget flow so the user could leave the page and retrieve the result on return.
- Impact: `enqueueAuditAction` / `enqueueAiGenerationAction` server actions enqueue tasks; `QueuePanel` (fixed-position client component) polls `/api/queue` every 3 s and shows status; deduplication via `dedupKey` prevents double-submission.

## 2026-04-24 - Explanation Column In All Question Flows
- Decision: add `explanation` (justificativa/gabarito) field to all question types, including dissertativa which previously had none.
- Reason: teachers need to record the expected answer or rationale for every question type; the field was already in the schema but not exposed for dissertativa, and was absent from CSV exports.
- Impact: question form, edit page, audit page, exports page, JSON export, CSV export (new column 12), JSON/CSV import parser, and AI review form all now handle `explanation` consistently.

## 2026-04-24 - React 19 useActionState For Form Preservation
- Decision: use React 19 `useActionState` in `QuestionForm` to return validation errors inline without page redirect.
- Reason: previous pattern (redirect with error param) wiped all form fields on validation failure.
- Impact: `createQuestionAction` and `updateQuestionAction` now accept `(prev, formData)` signature; the `ai-client.tsx` review form bridges with `async (fd) => createQuestionAction(undefined, fd)`.

## 2026-04-24 - Exam Form Title/Institution Preservation
- Decision: preserve title and institution inputs across exam-creation validation errors by forwarding them as URL params on redirect.
- Reason: consistent with how discipline filter already used URL params; avoids `useActionState` complexity in a server-rendered page.
- Impact: `createExamAction` appends `title` and `institution` to redirect URL on every error path; `ExamsPage` reads them as `searchParams` and sets `defaultValue`.

## 2026-04-24 - Remove Generic numQuestions Field
- Decision: remove the generic "questões por prova" total count input from exam creation; per-type counts are the only mechanism.
- Reason: having both fields created ambiguity about which took precedence when they conflicted.
- Impact: `normalizeExamSelectionRequest` only reads `numObjetivas`, `numVF`, `numDissertativas`; throws if all are zero; exam creation form no longer renders the generic count input.

## 2026-04-24 - Safe Filenames For CSV/PDF Downloads
- Decision: derive download filenames from exam titles using a slug transformation (`toLowerCase` + replace non-alphanumeric with `-`).
- Reason: arbitrary Unicode in filenames breaks `Content-Disposition` headers on Linux and some Windows locales.
- Impact: `/api/csv/[setId]` and PDF routes now produce filenames like `gabarito-prova-1-poo-2026-set-a.csv`.

## 2026-04-24 - AI Generation Queue Is The Primary UX
- Decision: both `/ai` and `/ai/import` enqueue generation tasks instead of making the primary button wait on a foreground streaming request.
- Reason: the prompt requires AI generation to continue while the user leaves the page, with visible status and recoverable results.
- Impact: added `ai-generate-single`; `QueuePanel` links individual results to `/ai?task=[id]` and batch results to `/ai/import?task=[id]`.

## 2026-04-24 - Obsidian Notes Are Project Source
- Decision: keep implementation-critical Obsidian Markdown under `docs/` and commit it with code.
- Reason: future agents need stable, versioned project context instead of relying on chat history or local-only memory.
- Impact: added [[PROMPT_T1_T11_STATUS]] and [[OBSIDIAN_GITHUB]]; `.obsidian/` stays ignored as local UI state unless explicitly shared later.

## 2026-04-24 - Queue Singleton Stored In globalThis
- Decision: store the in-memory task queue in `globalThis.__UNIFIL_EXAMS_TASK_QUEUE__` and register handlers lazily from Server Actions and queue API routes.
- Reason: in Next.js dev/runtime bundling, Server Actions and Route Handlers can load separate module instances; a plain module-level `const queue = []` can make tasks invisible to `/api/queue`.
- Impact: audit and AI tasks are visible to the bottom task panel, continue processing while navigating, and pages refresh when task status reaches a terminal state.

## 2026-04-24 - Pinia Equivalent Is Zustand Persist
- Decision: use Zustand with `persist` as the React/Next equivalent of Pinia for workspace UI state.
- Reason: the user wants route changes to feel like tab/panel navigation, preserving drafts and active task ids while continuing to use server actions and SQLite as source of truth.
- Impact: `/ai`, `/ai/import`, and `/exams` now keep draft fields in `localStorage` under `unifil-workspace-state`; manual question draft wiring remains a documented follow-up because file inputs must stay out of persisted state.

## 2026-04-27 - HTML Print Becomes The Official Exam Export
- Decision: replace `react-pdf` exam rendering with standalone HTML A4 print pages under `/print/*`, opened in a new tab and exported through the browser print dialog.
- Reason: the old two-column PDF renderer relied on estimated heights and produced unstable ordering, spacing, and last-page gabarito behavior.
- Impact: `/api/pdf/*` now redirect to `/print/*`; question pagination is measured in the real DOM; the gabarito stays pinned to the bottom of the last page; the official export path is browser print/save as PDF.

## 2026-04-28 - Inline Answer Key When The Batch Target Allows It
- Decision: if the gabarito fits in the remaining height of the last question page without changing the final batch page target, render it inline on that last page instead of forcing a dedicated gabarito-only page.
- Reason: teachers expect the renderer to reuse the free space at the bottom of the final page when possible.
- Impact: the print layout now measures the gabarito height, reserves that space on the last page during pagination, and only falls back to a separate final gabarito page when inline placement would break the batch-uniform page target.

## 2026-04-27 - Question Statement Uses Sanitized HTML
- Decision: treat `questions.statement` as sanitized HTML instead of markdown.
- Reason: the print pipeline needs faithful DOM measurement, richer formatting, and future support for complex layouts such as tables without markdown conversion artifacts.
- Impact: authoring stays as raw textarea input; previews, detail views, audit, exports, and print render sanitized HTML; compact lists and CSV snippets strip tags back to plain text.

## 2026-04-28 - AI Prompts Share The Same HTML-Capable Contract
- Decision: centralize AI prompt templates so single generation, batch generation, and copied import prompts all describe the same HTML-capable `statement` contract.
- Reason: the import prompt had the clearest guidance, but the runtime AI builders still used older prompt variants without the same HTML and field rules.
- Impact: all AI flows now instruct models to emit the same core fields, allow sanitized HTML in `statement`, and expose the active prompt back to the user in the UI.

## 2026-04-28 - Local Issue Chat Sends Directly To GitHub
- Decision: add a floating issue chat in the app shell that opens a prefilled GitHub issue draft in the browser, letting GitHub handle login at submit time.
- Reason: the user wants a zero-config flow without local tokens or extra setup, while still capturing bugs and ideas from inside the app.
- Impact: `/api/github/issues` is now only a lightweight config endpoint that exposes the target repo/labels; the chat opens `github.com/<repo>/issues/new?...` with title/body prefilled, and the app favicon uses the UniFil logo from `public/unifil-logo.jpg`.
