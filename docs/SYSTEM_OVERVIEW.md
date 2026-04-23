---
title: System Overview
tags:
  - product/scope
  - system/overview
aliases:
  - Visao Geral do Sistema
status: draft
---

# System Overview

UniFil Exams sera um aplicativo local para criar, auditar, gerar e montar provas objetivas por disciplina.

> [!important]
> V1 foca em banco de questoes, auditoria, geracao com IA, montagem de sets, PDF para impressao e gabarito CSV. Correcao automatica fica fora do escopo.

## Objetivo
- Substituir processo manual de criacao de provas objetivas.
- Reduzir retrabalho na revisao das questoes.
- Melhorar qualidade pedagogica das alternativas geradas com IA.
- Gerar versoes equivalentes da mesma prova com randomizacao de questoes e alternativas.

## Usuarios
- Professor ou responsavel pela disciplina.
- Coordenador/revisor que audita questoes antes da prova.
- Aluno apenas recebe o PDF impresso; nao usa o sistema na V1.

## Modulos Principais
- **Disciplinas**: cadastro e organizacao do banco de questoes.
- **Banco de Questoes**: cadastro manual, edicao, exclusao e anexos de imagem.
- **Auditoria**: revisao visual de enunciado, alternativas A-E, resposta correta e imagem.
- **Geracao com IA**: criacao de questoes estruturadas com cinco alternativas.
- **Montagem de Prova**: selecao de questoes e criacao de sets.
- **Exportacao**: PDF em duas colunas, imagem EvalBee por set na ultima pagina e CSV de gabarito.

## Fora do Escopo V1
- Correcao automatica das provas.
- Prova online para alunos.
- Login, permissoes e multiusuario.
- Integracao direta com sistema academico.
- Banco remoto ou sincronizacao em nuvem.

## Relacoes
- Detalhes de arquitetura: [[ARCHITECTURE]]
- Modelo de dados: [[DATA_MODEL]]
- Fluxos de usuario: [[USER_WORKFLOWS]]
- IA: [[AI_GENERATION]]
- PDF, CSV e EvalBee: [[EXPORTS_EVALBEE]]
