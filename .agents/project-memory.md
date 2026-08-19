---
title: UniFil Exams Project Memory
tags:
  - agents/memory
  - project/unifil-exams
status: active
---

# Project Memory

## Stable context

- Repository: `UniFil-Exams`; local-first, single-user academic exam workspace.
- Stack: Next.js `16.2.4`, React `19.2.4`, TypeScript, SQLite via `better-sqlite3`, Zustand `5` already present.
- Production recovery uses the repository package under `ops/system-backup/`: encrypted Restic over rclone Google Drive, daily user-systemd timer, application-consistent SQLite/PostgreSQL snapshots, explicit secret allowlist, and extraction-only restore tooling. By explicit owner decision, the password exists on the server, in a protected Windows recovery file, and as plaintext at `Servidor-Eron/RECUPERACAO-NAO-APAGAR/restic-password.txt` in the same Drive; document the exposure but do not print the secret.
- Worktree for the 2026-08-04 UI bundle: `C:\Users\eronp\.codex\worktrees\71c7\UniFil-Exams`.
- User data and uploads are out of scope for UI work; do not read, copy, seed, migrate or delete them.
- Print routes and components are compatibility-sensitive and are not owned by the app UI task.

## Current UI architecture

- `(app)/layout.tsx` owns the normal shell composition: `Nav`, `CommandPalette`, `QueuePanel`, `IssueChatPanel` and main landmark.
- `src/components/nav.tsx` provides grouped navigation, desktop collapse, mobile drawer, skip link, theme control and the visible keyboard shortcut.
- `src/lib/state/ui-store.ts` persists theme and sidebar preferences under `unifil-ui-preferences`.
- `src/components/ui.tsx` exports shared `PageHeader`, `SectionCard`, `StatCard`, `ProgressDisplay`, `EmptyState`, `WorkflowStepper` and `StatusBadge`.
- `src/components/icon.tsx` is the no-dependency inline SVG icon system using `currentColor`.
- `src/components/command-palette.tsx` handles `Ctrl/Cmd + K`, search, focus, Escape, arrows and Enter; navigation is client-only.
- `src/lib/db/stats.ts` adds read-only dashboard aggregation through `getDashboardStats()`.
- Question detail and edit screens share discipline-scoped previous/next navigation; the edit form shows the current image at large size directly after the statement and keeps replacement upload separate.
- The question bank supports selecting multiple questions and applying one shared thematic area without changing their statements; submitting a blank area clears it from the selection.
- The full answer key on `/exports` reproduces Set A question positions and objective-option shuffling, so its marked letters match the Set A quick CSV; other per-set PDFs and CSVs retain their own shuffled order.
- `/exports` also offers a high-resolution commented PNG per set; `/api/png/[setId]?version=N` preserves the selected version snapshot, shuffled answer, source bank ID and justification.
- The desktop sidebar collapse toggle remains visible in the compact 82px rail, allowing the persisted collapsed state to be expanded again.
- Manual question creation accepts an image file or `Ctrl/Cmd + V` clipboard image, shows a preview, and can remove the pending image before submit.
- The question bank has an explicit no-thematic-area filter covering normalized null/blank areas.
- Exam creation has an opt-in compact order (default false): type order remains objective/VF/numeric/discursive, and each type persists randomized `column` questions before randomized `full` questions. Stored set position remains authoritative for every answer-key/trace export.
- Printed question images fill their resolved question width but are proportionally capped at 25% of printable page area and 50% of page height.

## Product IA

`ORGANIZAR → REVISAR → CRIAR → ENTREGAR`.

- Organizar: `/`, `/disciplines`, `/questions` and question CRUD/import routes.
- Revisar: `/audit`.
- Criar: `/questions/new`, `/questions/importar`, `/ai`, `/ai/import`, `/exams`.
- Entregar: `/exports`, `/print/*`, PDF/CSV/ZIP endpoints.
- Sistema: `/settings`.

## Verification evidence — 2026-08-04

- `rtk npm ci`: restored 580 packages from the existing lockfile; no package manifest changes.
- `rtk npm run typecheck`: exit 0.
- `rtk npm run lint`: exit 0.
- `rtk npm test -- --run`: 16 files, 82 tests passed.
- `rtk npm run build`: exit 0; all app, API and print routes listed. One non-fatal NFT tracing warning remains for the pre-existing runtime image route.
- Required Next docs path under `node_modules/next/dist/docs/01-app/01-getting-started/` was absent before dependency restoration; Next 16 package conventions were followed and the production build verified the result.

## Durable cautions

- Preserve names, IDs, search params, Server Action signatures, queue task links, upload behavior and print selectors beginning `exam-print-`.
- Exam print width is a persisted per-type preference: objective/VF/numeric default to `column`; discursive defaults to `full`. Missing or invalid legacy columns must normalize to those values.
- Do not add an icon dependency; use `Icon`.
- Keep documentation Obsidian-friendly with frontmatter and `[[wikilinks]]`.
- Prefix useful shell commands with `rtk`.

## Print fragmentation caution

- `Exam.allowQuestionSplit` is persisted per exam and defaults false for legacy/new rows.
- The official HTML print path remains a JS-measured absolute paginator: opt-in splitting measures contiguous objective option ranges, preserves shuffled letters/order, and keeps V/F, numeric, discursive, table, and unsupported structures atomic.
- Keep answer-key reserved-last-page and uniform-page calculations on the same split-aware pagination path.

## Import and EvalBee trace continuity

- `buildImportPrompt()` is the sole source for the copied import prompt; keep its nine-field question contract and dynamic HTML sanitizer labels aligned with `src/lib/html/rich-text.ts`.
- The long-form trace export is `src/app/api/csv/exam/[examId]/trace/route.ts` backed by `buildExamTraceCsv()`; its stable key is `examId:setLabel:position`, and its row order is set label then stored position (base 1).
- Existing answer-key CSV routes are compatibility-sensitive and must remain separate from the trace export.
