# Project Context

## Stable Facts
- Project name: UniFil Exams.
- Repository started empty on 2026-04-22.
- No application stack has been selected yet.
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

## Current Assumptions
- Keep docs markdown-first and Obsidian-friendly.
- Keep implementation decisions reversible until product scope is clear.
- Use persistent local memory for continuity, but avoid duplicating codebase facts that agents can inspect directly.
- V1 is local-first, single-user, no login.
- Programming-heavy implementation is deferred until the system structure is documented.

## Open Questions
- Exact implementation timeline and phase split.
- Final package/dependency choices for PDF, SQLite, and local model access.
- Exact shape of import/export files beyond CSV answer key.
