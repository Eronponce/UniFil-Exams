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
