---
title: Obsidian and GitHub Workflow
tags:
  - project/docs
  - obsidian
  - github
status: active
aliases:
  - Obsidian GitHub
  - Vault Workflow
---

# Obsidian and GitHub Workflow

> [!important]
> The Markdown notes in `docs/` are project source files. They should be committed and pushed with code because future agents use them as implementation context.

## What Goes to GitHub

- `docs/*.md`: product context, decisions, screen map, workflows, architecture, and implementation status.
- `README.md`: public entry point.
- `AGENTS.md` and `CLAUDE.md`: agent bootstrap instructions.
- `.agents/project-memory.md` is currently ignored by `.gitignore`; keep durable project knowledge in `docs/` when it must travel with GitHub.

## What Stays Local

- `.obsidian/`: local Obsidian UI/workspace state, plugins, and machine-specific settings.
- `data/*.db`: local SQLite database.
- `public/uploads/*` and `public/gabaritos/*`: user-uploaded runtime files.
- `.env.local`: local secrets/configuration.

## Editing Rules

- Add frontmatter to new notes: `title`, `tags`, `status`, and useful `aliases`.
- Use wikilinks for internal notes, for example [[PROJECT_CONTEXT]] and [[DECISIONS]].
- Put long-lived decisions in [[DECISIONS]].
- Put session facts and validation output in [[SESSION_LOG]].
- Put implementation coverage in [[PROMPT_T1_T11_STATUS]].
- Keep [[INDEX]] as the map of the vault.

## Suggested Commit Scope

When pushing an implementation bundle, include code and docs together:

```powershell
git add README.md docs AGENTS.md CLAUDE.md src package.json package-lock.json
git commit -m "Complete prompt bundle and document Obsidian context"
git push origin <branch>
```

> [!tip]
> Do not commit `.obsidian/` unless the team explicitly decides to share a vault configuration. The essential Obsidian content is the Markdown note graph.
