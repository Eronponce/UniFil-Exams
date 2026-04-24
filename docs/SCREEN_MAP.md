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
- Seletor de disciplina, tipo de questão e provedor.
- Campo de tema/competência.
- Resultado estruturado editável com justificativa.
- Botão salvar no banco apenas após validação.
- Botão "Gerar questões na fila" para geração assíncrona via fila.

## Fila de Tarefas (QueuePanel)
- Componente fixo canto inferior direito (z-index 9999).
- Exibe até 50 tarefas recentes (audit + ai-generate + ai-generate-single).
- Expansível/recolhível.
- Badges por status: pending (amarelo), processing (azul pulsando), done (verde), error (vermelho), cancelled (cinza).
- Botão cancelar para pending/processing.
- Link "Ver" → `/ai/import?task=[id]` para lotes concluídos.
- Link "Ver" → `/ai?task=[id]` para geração individual concluída.

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
