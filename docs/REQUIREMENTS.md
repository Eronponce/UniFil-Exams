---
title: Requirements
tags:
  - product/requirements
  - system/scope
aliases:
  - Requisitos
status: draft
---

# Requirements

## Requisitos Funcionais
- Cadastrar, listar, editar e arquivar disciplinas.
- Cadastrar questoes objetivas por disciplina.
- Cada questao deve ter enunciado, alternativas A-E, alternativa correta e imagem opcional.
- Auditar questoes manualmente com edicao completa e exclusao.
- Gerar questoes com IA usando Qwen local, Claude API ou Gemini API.
- Validar questoes geradas antes de salvar.
- Selecionar questoes para montar prova.
- Gerar multiplos sets da mesma prova.
- Randomizar ordem das questoes por set.
- Randomizar ordem das alternativas por questao em cada set.
- Recalcular gabarito apos randomizacao.
- Exportar PDF por set em layout de duas colunas.
- Anexar imagem EvalBee especifica como ultima pagina do PDF de cada set.
- Exportar CSV de gabarito por set.

## Requisitos Nao Funcionais
- Rodar localmente na V1.
- Nao exigir login na V1.
- Manter dados em SQLite local.
- Guardar imagens em pasta local do projeto.
- Priorizar backup simples: banco + pasta de uploads.
- Evitar dependencia de internet para uso basico sem IA externa.
- Permitir uso de IA local quando Ollama/llama.cpp estiver configurado.
- Gerar PDF com legibilidade para impressao.

## Restricoes
- Somente provas objetivas.
- Sem correcao automatica na V1.
- Sem prova online para alunos.
- Sem integracao direta com sistemas UniFil na V1.
- Sem marcar bolhas EvalBee automaticamente na V1.

## Criterios de Aceite V1
- Usuario cria disciplina e banco de questoes reutilizavel.
- Usuario audita questoes antes da prova.
- Usuario gera questao com IA e revisa antes de salvar.
- Usuario monta sets A/B/C ou outra quantidade.
- PDFs dos sets possuem ordem diferente e imagem EvalBee correta no final.
- CSV de cada set bate com as alternativas finais.
