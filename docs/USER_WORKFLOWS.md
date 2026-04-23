---
title: User Workflows
tags:
  - product/workflows
  - ux
aliases:
  - Fluxos de Usuario
status: draft
---

# User Workflows

## 1. Cadastrar Disciplina
1. Usuario cria disciplina.
2. Sistema mostra disciplina na lista.
3. Usuario entra no banco de questoes dessa disciplina.

## 2. Criar Questao Manual
1. Usuario escolhe disciplina.
2. Informa enunciado, alternativas A-E e correta.
3. Anexa imagem opcional.
4. Salva como rascunho ou auditada.

## 3. Auditar Questao
1. Usuario abre fila/lista de questoes da disciplina.
2. Visualiza enunciado, imagem, alternativas e correta.
3. Edita conteudo se necessario.
4. Exclui questao ruim ou marca como auditada.

## 4. Gerar Questao com IA
1. Usuario escolhe disciplina e provedor IA.
2. Descreve tema/competencia desejada.
3. Sistema envia prompt padronizado.
4. Sistema recebe questao estruturada.
5. Usuario revisa antes de salvar.

## 5. Montar Prova
1. Usuario escolhe disciplina.
2. Seleciona questoes auditadas.
3. Define sets necessarios, por exemplo A, B, C.
4. Anexa imagem EvalBee correspondente a cada set.
5. Sistema randomiza questoes e alternativas por set.
6. Sistema gera PDF e CSV de gabarito.

## 6. Usar EvalBee
1. Usuario prepara imagem EvalBee do set fora do sistema.
2. Marca previamente a bolha do set na imagem, quando necessario.
3. Anexa imagem ao set correspondente.
4. PDF final inclui essa imagem na ultima pagina.
5. Usuario configura/corrige no EvalBee usando o gabarito CSV como referencia.

## Aceite V1
- Professor consegue sair de banco de questoes ate PDF final sem planilha manual.
- Cada set tem PDF proprio e CSV proprio.
- Gabarito bate com alternativas randomizadas.
- Imagem EvalBee correta aparece na ultima pagina do set.
