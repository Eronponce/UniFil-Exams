# Changelog

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
