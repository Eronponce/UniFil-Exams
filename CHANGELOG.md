# Changelog

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
