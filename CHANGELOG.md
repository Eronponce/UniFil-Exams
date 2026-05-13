# Changelog

## [2.4.3] - 2026-05-13

### Features

- Set a new application favicon (`public/favicon-unifil.png`) from the provided brand mark

### Bug Fixes

- Fix exports/print preview assets in Docker by serving logo and answer-key images through API file routes
- Add cache-busting to answer-key preview URLs to avoid stale image references after uploads

### Chores

- Validate production container rebuild and runtime (`docker compose up --build -d`)

---

## [2.4.2] - 2026-05-13

### Features

- Add optimistic audit UX so cards disappear immediately on `✓ Auditar` / `Des-auditar`, with rollback on server failure
- Improve print layout for statement tables with adaptive scale logic, prioritizing half-width placement and falling back to full width only when needed

### Bug Fixes

- Prevent hydration mismatch noise caused by browser extensions injecting attributes on `<body>` before React hydration
- Improve exports preview navigation to open in the same tab and avoid duplicate history entries on return from print preview
- Reduce floating issue CTA obstruction by converting it to a compact bottom-right GitHub FAB positioned above the task panel

### Chores

- Update audit and print behavior notes in `docs/SESSION_LOG.md`
- Validate release build and runtime via Docker Compose (`docker compose up --build -d`)

---

## [2.4.1] - 2026-04-29

### Bug Fixes

- Fix audit queue actions getting visually stuck in `Na fila...` by making the audit buttons watch their own task status and refresh the page as soon as the queued audit finishes
- Improve the global queue panel so fast tasks that finish between polls still trigger a page refresh

### Chores

- Add Docker production runtime files (`Dockerfile`, `compose.yml`, `.dockerignore`) and document the local release flow

---

## [2.4.0] - 2026-04-28

### Features

- Keep the answer key inline on the last page when it fits, while still preserving the uniform page target across all sets in the same batch
- Unify AI prompt templates across single generation, batch generation, and copied import prompts, with explicit support for sanitized HTML in `statement`
- Add a floating GitHub issue chat that opens a prefilled issue draft in the project repo and lets GitHub handle login at submit time
- Use the UniFil logo as the application favicon

### Bug Fixes

- Make individual set exports honor the same batch-wide target page count used by the full exam export
- Remove the previous token-only GitHub issue flow in favor of a zero-config browser compose flow

### Chores

- Document the new AI prompt contract, issue chat flow, favicon setup, and updated PDF answer-key behavior

---

## [2.3.0] - 2026-04-28

### Features

- Replace the old `react-pdf` exam flow with HTML A4 print pages under `/print/*`, including browser preview and direct PDF generation from the same rendered document
- Treat question statements as sanitized HTML across the app, enabling richer formatting such as emphasis, lists, marks, and tables in previews and exports
- Add per-exam answer key width controls with persisted configuration and proportional preview in the exports UI

### Bug Fixes

- Fix exam pagination order and last-page answer key placement in the new HTML export flow
- Fix direct PDF generation to keep header and question body together and avoid trailing blank pages
- Fix `Gabarito Completo` in `/exports` to render only the selected exam and preserve rich statement formatting plus question images

### Chores

- Restructure the App Router into `(app)` and `(print)` route groups to isolate the print shell from the main application shell

---

## [2.2.0] - 2026-04-24

### Features

- Persist workspace state across navigation (`feat: persist workspace state`)
- Add "Nova Questão" nav link with Zustand-persisted draft state — navigate to Auditoria and back without losing the form

### Bug Fixes

- Enlarge answer key image for better readability (`fix: enlarge answer key image`)
- Stabilize background task queue to prevent race conditions (`fix: stabilize background task queue`)
- Fix broken UTF-8 encoding in `exams/page.tsx` and `exam-draft-fields.tsx` (mojibake chars like `Ã§`, `Â·`, `â†'` replaced with correct Unicode)
- Fix controlled-input reset bug that blocked typing in AI Generation and AI Import fields

### Chores

- Complete prompt bundle with queued AI and docs

---

## v2.1.0 - 2026-04-23

### Added
- Real-time AI streaming for single-question and batch generation flows.
- Global toast and flash feedback system for create, update, delete, audit, import, upload, and exam creation actions.
- Per-type exam composition controls for objetiva, verdadeiro/falso, and dissertativa questions.
- Persistent implementation checklist in `docs/TODO.md`.

### Changed
- AI trace panel now shows live execution events while generation is in progress.
- Exam PDF renderer now packs sections continuously to reduce forced page breaks between sections.
- Validation tooling now ignores temporary `.claude` worktrees in ESLint and Vitest.
- README, project context, decisions, session log, and persistent memory were updated to reflect the current product state.

### Fixed
- Error traces from AI generation now propagate back to the UI even on parser failures.
- Client-side filters and model loading hooks were adjusted to satisfy current React and Next.js lint/build requirements.
