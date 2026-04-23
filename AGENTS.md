# Agent Instructions

## Project Context
- Repository: `UniFil-Exams`.
- Current state: empty project scaffold; no runtime stack selected.
- Primary docs: `README.md`, `docs/PROJECT_CONTEXT.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`.
- Persistent agent memory: `.agents/project-memory.md`.

## Working Rules
- Use persistent memory when it helps project continuity.
- Treat Obsidian-style markdown docs as part of the default workflow for notes, project knowledge, and local documentation.
- RTK is installed and required. Prefix shell commands with `rtk` when the command can produce useful or verbose output.
- Native Windows/Codex has no automatic RTK hook here. Use explicit commands such as `rtk git status`, `rtk read <file>`, `rtk grep <pattern> .`, and `rtk proxy <cmd>` for raw passthrough when needed.
- Caveman communication is default: terse, technical, no filler. Stop only if user asks for normal mode.
- Do not invent a tech stack. Inspect repo and ask only when a stack choice changes architecture or future migration cost.
- Prefer small, reversible changes while the project scope is still forming.
- Keep stable decisions in `docs/DECISIONS.md`; keep session-level continuity in `docs/SESSION_LOG.md`.

## Session Bootstrap
- On new sessions in this repo, read `.agents/project-memory.md` first when continuity matters.
- Then check `docs/BOOTSTRAP.md` for active tool/memory expectations.
- For docs/notes work, use Obsidian markdown conventions: frontmatter, wikilinks for internal notes, and concise callouts when useful.
- Claude Code should load `CLAUDE.md`, which imports this file. Codex should load this `AGENTS.md`.
- If an expected tool is unavailable, state it immediately and continue with the closest safe fallback only if the user allows it.

## Workflow Orchestration
- For non-trivial tasks, write a short plan before edits.
- If assumptions break, stop and re-plan before continuing.
- Do not mark tasks done without evidence: tests, logs, diffs, or command output.
- Capture durable lessons in docs when they reduce repeat mistakes.
- Bias: simplicity first, root-cause over patchwork, minimal-impact changes.

## Framework Notes
- Stack: Next.js `16.2.4` + React `19.2.4` + TypeScript. APIs and conventions differ from earlier versions.
- Before writing Next.js-specific code, read `node_modules/next/dist/docs/` for the installed version's conventions.
- App Router only — no Pages Router.
- Vitest for tests (`npm test`); `npm run typecheck` for tsc; `npm run lint` for eslint.

## Token Efficiency
- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.
