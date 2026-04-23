---
title: Session Bootstrap
tags:
  - project/bootstrap
  - agents
aliases:
  - Agent Startup
  - Session Start
status: active
---

# Session Bootstrap

Use this note at start of Codex or Claude sessions for [[PROJECT_CONTEXT|project context]] and tool expectations.

> [!important]
> This repo expects persistent memory, RTK, Caveman responses, and Obsidian-style markdown docs.

## Required Checks
- Confirm working directory is `C:\Users\eronp\Documentos\GitHub\UniFil-Exams`.
- Read `.agents/project-memory.md` when continuity matters.
- Read [[PROJECT_CONTEXT]] before product or architecture decisions.
- Use `rtk` for shell commands that can produce useful output.
- Use `asm` to inspect/manage installed skills across agents when skill state matters.
- Keep responses Caveman-style unless user asks for normal mode.
- Use Obsidian markdown conventions for docs and notes.

## Codex
- Global RTK awareness: `C:\Users\eronp\.codex\RTK.md`.
- Project instructions: `AGENTS.md`.
- Native Windows/Codex: no automatic RTK hook; use explicit `rtk ...`.
- Codex CLI installed globally as `@openai/codex` version `0.122.0`.
- ASM sees Codex skills in `C:\Users\eronp\.codex\skills`.
- Claude-mem is not installed as a Codex plugin in `C:\Users\eronp\.codex`; use local project memory unless Codex memory plugin/MCP is configured.

## Claude
- Global RTK hook configured in `C:\Users\eronp\.claude\settings.json`.
- Global Claude memory imports `C:\Users\eronp\.claude\RTK.md`.
- Project Claude entrypoint: `CLAUDE.md`, which imports `AGENTS.md`.
- `claude-mem@thedotmack` is enabled in Claude settings.
- Claude-mem plugin version observed locally: `12.3.8`.

## Verification Commands
```powershell
rtk --version
rtk init --show
rtk git status --short
rtk proxy asm --version
rtk proxy asm stats --json
rtk proxy codex --version
```

## If Something Is Missing
- Say which expected tool/config is missing.
- Do not silently downgrade from RTK or persistent memory.
- Update [[SESSION_LOG]] and `.agents/project-memory.md` after fixing durable environment issues.
