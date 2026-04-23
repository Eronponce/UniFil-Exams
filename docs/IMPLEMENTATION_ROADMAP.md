---
title: Implementation Roadmap
tags:
  - project/roadmap
  - implementation
aliases:
  - Roadmap de Implementacao
status: draft
---

# Implementation Roadmap

Desenvolvimento fica para depois. Esta nota define ordem segura.

## Fase 0 - Documentacao e Ferramentas
- Consolidar escopo, requisitos, fluxos, dados, IA, exportacao e tooling.
- Instalar ferramentas de contexto.
- Nao criar app ainda.

## Fase 1 - Scaffold Tecnico
- Criar projeto Next.js + TypeScript.
- Configurar lint/typecheck/testes.
- Definir estrutura de pastas.
- Criar configuracao local de ambiente.

## Fase 2 - Persistencia
- Adicionar SQLite.
- Criar schema inicial.
- Criar camada de acesso a dados.
- Criar seed minimo para teste local.

## Fase 3 - Disciplinas e Questoes
- CRUD de disciplinas.
- CRUD de questoes.
- Upload de imagem de questao.
- Auditoria manual.

## Fase 4 - Geracao com IA
- Integrar Qwen local.
- Integrar Claude API.
- Integrar Gemini API.
- Validar resposta estruturada.
- Salvar somente apos revisao humana.

## Fase 5 - Montagem e Randomizacao
- Selecionar questoes.
- Criar sets.
- Randomizar questoes e alternativas.
- Gerar gabarito por set.

## Fase 6 - PDF, CSV e EvalBee
- Layout duas colunas.
- Renderizar imagens de questoes.
- Anexar imagem EvalBee por set na ultima pagina.
- Exportar CSV de gabarito.

## Fase 7 - Qualidade
- Testes de randomizacao e gabarito.
- Testes de PDF com imagens.
- Testes de falhas de IA.
- Backup/exportacao manual de dados.

## Definition of Ready para Programacao
- Usuario aprova docs de escopo.
- Ferramentas basicas verificadas.
- Decidir se Ollama sera iniciado localmente ou se llama.cpp sera usado.
- Confirmar modelo exato Qwen disponivel na maquina.
