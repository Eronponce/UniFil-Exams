---
title: Active Todo
tags:
  - project/todo
  - implementation
status: active
aliases:
  - Implementation Checklist
---

# Active Todo

Use this note with [[SESSION_LOG]] and [[DECISIONS]] to track the latest requested implementation bundle.

> [!note]
> Last bundle: 2026-04-24 — T1–T11 (justificativa, audit fix, PDF uniform, queue, form preservation).

## 2026-04-23 Bundle
- [x] Expor geração IA em tempo real para depuração de falhas.
- [x] Mostrar mensagens de estado dos processos principais do sistema.
- [x] Criar sistema global de toast/flash para feedback consistente.
- [x] Evitar quebra forçada de página ao iniciar nova seção no PDF quando houver espaço sobrando.
- [x] Permitir escolher quantas questões `objetivas`, `V/F` e `dissertativas` entram na prova.
- [x] Registrar as mudanças em documentação e memória persistente.

## 2026-04-24 Bundle
- [x] T1: Justificativa para questões dissertativas (form, edit, audit, export, import).
- [x] T2: Justificativa visível na auditoria para todos os tipos.
- [x] T3: Corrigir botões de auditoria (type="button", sem form aninhado, sem reload).
- [x] T4: Downloads CSV/PDF portáveis no Linux (filenames safe, UTF-8).
- [x] T5: Botões copiar-para-clipboard na página de importação.
- [x] T6: Remover campo genérico numQuestions; validar ao menos um tipo > 0.
- [x] T7: PDF uniforme por batch (mesma contagem de páginas pares; gabarito sempre último).
- [x] T8: Fila em memória para auditoria (dedup, cancel, painel de status).
- [x] T9: Fila em memória para geração IA (resultado recuperável ao voltar para a página).
- [x] T10: Preservar dados do formulário após erros (questão, prova, IA).
- [x] T11: Atualizar documentação do projeto.
- [x] Fechar lacunas finais: fila tambem em `/ai`, campos visiveis JSON/CSV, PDF individual por set e preservacao de quantidades da prova.
- [x] Criar notas Obsidian versionaveis: [[PROMPT_T1_T11_STATUS]] e [[OBSIDIAN_GITHUB]].

## Follow-up (pendente)
- [ ] Conectar `/questions/new` ao `questionDrafts` do Zustand sem persistir upload/imagem.
- [ ] Smoke manual no navegador dos fluxos de streaming com Ollama/Claude/Gemini reais.
- [ ] Validar visualmente PDFs longos com combinações mistas de seção para ajustar densidade.
- [ ] Testar QueuePanel no navegador com operações reais de auditoria e geração IA.
