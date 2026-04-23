---
title: Screen Map
tags:
  - product/ui
  - ux/navigation
aliases:
  - Mapa de Telas
status: draft
---

# Screen Map

Mapa funcional de telas para orientar a implementacao futura.

## Navegacao Principal
- Dashboard
- Disciplinas
- Banco de Questoes
- Auditoria
- Geracao IA
- Montagem de Prova
- Exportacoes
- Configuracoes

## Dashboard
- Resumo de disciplinas.
- Questões em rascunho/auditoria.
- Provas recentes.
- Atalhos para nova questao, gerar com IA e montar prova.

## Disciplinas
- Lista de disciplinas.
- Criar/editar disciplina.
- Ver quantidade de questoes por status.

## Banco de Questoes
- Filtro por disciplina, status e busca textual.
- Lista com enunciado resumido, correta e status.
- Acoes: abrir, editar, duplicar, arquivar/excluir.

## Auditoria
- Visualizacao completa da questao.
- Enunciado, imagem, alternativas A-E e correta em destaque.
- Edicao inline ou formulario completo.
- Marcar como auditada.

## Geracao IA
- Seletor de disciplina.
- Seletor de provedor: Qwen local, Claude API, Gemini API.
- Campo de tema/competencia.
- Resultado estruturado editavel.
- Botao salvar no banco apenas apos validacao.

## Montagem de Prova
- Selecionar disciplina.
- Selecionar questoes auditadas.
- Definir titulo da prova.
- Definir quantidade/codigos de sets.
- Anexar imagem EvalBee por set.
- Gerar previa.

## Exportacoes
- Baixar PDF por set.
- Baixar CSV por set.
- Conferir ordem final de questoes e alternativas.
- Conferir imagem EvalBee vinculada a cada set.

## Configuracoes
- Caminho do banco e uploads.
- Configuracao Qwen/Ollama ou llama.cpp.
- Chaves Claude/Gemini via ambiente, com estado "configurado/ausente".
- Preferencias de PDF: tamanho de pagina, margens e fonte.
