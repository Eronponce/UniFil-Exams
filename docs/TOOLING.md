---
title: Tooling
tags:
  - project/tooling
  - environment
aliases:
  - Ferramentas
status: active
---

# Tooling

## Ferramentas Ativas
- RTK: `rtk 0.37.2`
- ASM: `asm v2.3.0`
- Node.js: `v22.20.0`
- npm: `10.9.3`
- Codex CLI: `0.122.0`
- chub: `0.1.3`
- Ollama client: `0.12.3`

## Instalado Nesta Sessao
- `@aisuite/chub` global via npm.
- Registry chub atualizado apos limpar cache.

> [!warning]
> npm avisou que `posthog-node@5.29.4` pede Node `^20.20.0 || >=22.22.0`; maquina esta em Node `v22.20.0`. Instalacao concluiu, mas se `chub` falhar no futuro, atualizar Node para `>=22.22.0`.

## Estado do Ollama
- Cliente Ollama existe.
- Instancia Ollama nao estava rodando durante bootstrap.
- Modelo Qwen nao foi baixado nesta fase.

## Fontes de Contexto Encontradas via chub
- Claude API: `anthropic/claude-api`
- Gemini SDK: `gemini/genai`
- PDF Chromium: `puppeteer/puppeteer`
- TypeScript: `typescript/typescript`

> [!note]
> Busca chub por Ollama nao retornou doc especifica util; na implementacao, usar docs oficiais do Ollama/llama.cpp como fonte antes de codar integracao local.

## Comandos de Verificacao
```powershell
rtk --version
rtk proxy asm --version
rtk proxy node --version
rtk proxy npm --version
rtk proxy chub help
rtk proxy ollama --version
```

## Ferramentas Futuras de Desenvolvimento
- Next.js + React + TypeScript.
- SQLite driver/ORM a decidir na fase de scaffold.
- Puppeteer ou Playwright para PDF.
- Test runner a decidir com stack.
- Ollama ou llama.cpp para Qwen local.

## Politica
- Usar RTK em comandos shell.
- Usar ASM para inspecionar skills.
- Usar chub ou docs oficiais antes de codar APIs externas.
- Nao instalar modelos grandes sem etapa propria.
