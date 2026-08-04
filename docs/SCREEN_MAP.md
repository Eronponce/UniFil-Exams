---
title: Screen Map
tags:
  - product/ui
  - ux/navigation
aliases:
  - Mapa de Telas
status: active
---

# Screen Map

Mapa da arquitetura de informação do UniFil Exams. O fluxo principal é:

`ORGANIZAR → REVISAR → CRIAR → ENTREGAR`

## Shell global

- Sidebar desktop recolhível com a identidade UniFil Exams e navegação agrupada.
- Barra superior móvel e drawer acessível; não há sidebar persistente de 220px em telas pequenas.
- Tema persistente `Sistema`, `Claro` ou `Escuro`; preferência da sidebar persistida localmente.
- Link “Ir para o conteúdo principal”, foco visível, alvos de toque confortáveis e respeito a `prefers-reduced-motion`.
- `Ctrl/Cmd + K` abre a paleta de comandos com busca, grupos de destino, ações de criação e operação por teclado.
- Dock de atividade flutuante reúne `QueuePanel` e chat de feedback; tarefas ativas continuam visíveis durante a navegação.

## Organização — `/`

### `/` — Visão geral

Centro de comando com boas-vindas contextual, ações rápidas, KPIs de disciplinas/questões/auditoria/provas, prontidão por disciplina, continuidade do fluxo, itens pendentes e avaliações recentes.

### `/disciplines`

Lista de disciplinas ativas com código, nome, quantidade de questões, edição e desativação. Estado vazio orienta a criar a primeira disciplina.

### `/disciplines/new` e `/disciplines/[id]/edit`

Formulários de cadastro/edição preservando os nomes dos campos, Server Actions e URLs existentes.

### `/questions`

Banco pesquisável por disciplina, tipo, status, área temática e texto. Mantém seleção em lote, edição, exclusão, importação e exportação JSON/CSV.

### `/questions/new`, `/questions/[id]` e `/questions/[id]/edit`

Criação, leitura, auditoria, edição, exclusão, navegação anterior/próxima e upload de imagem. O contrato de campos e o HTML sanitizado do enunciado permanecem compatíveis.

### `/questions/importar`

Fluxo em três estados: referência/template, leitura e preview do arquivo, seleção/importação concluída. Aceita JSON/CSV e mantém a revisão antes da persistência.

## Revisão — `/audit`

Filtros por disciplina e seções para pendentes, recusadas e auditadas. Cada cartão mostra enunciado rico, imagem, alternativas/resposta, justificativa e ações de auditar, recusar, restaurar, editar e excluir.

## Criação assistida — `/ai` e `/ai/import`

- `/ai`: uma questão por vez, provedor/modelo, tema, fila em background, trace e formulário de revisão antes de salvar.
- `/ai/import`: lote de tópicos/texto, fila recuperável por `?task=`, preview selecionável, edição de área temática e salvamento em lote.
- `QueuePanel` preserva polling, cancelamento e links de recuperação dos resultados.

## Avaliações — `/exams`

Seleciona disciplina, áreas e questões auditadas; define título, instituição, quantidade de sets e composição por tipo; cria prova com randomização. Lista provas existentes com acesso às exportações e exclusão confirmada.

## Entrega — `/exports`

Seleciona uma prova, anexa/substitui gabarito EvalBee e ajusta sua largura, atualiza logo institucional, abre preview HTML A4 e oferece PDF, CSV por set e ZIP. O gabarito completo permanece disponível para conferência.

### Rotas de impressão preservadas

- `/print/exam/[examId]`
- `/print/set/[setId]`

Essas rotas continuam fora do shell normal. Classes `exam-print-*`, DOM de medição, paginação A4 e regras de impressão não participam da navegação de trabalho.

## Sistema — `/settings`

Leitura de configuração dos provedores IA e caminhos de armazenamento local. O controle de tema e preferências de navegação fica disponível no shell em qualquer rota.

## Padrões de interface

- `PageHeader` para eyebrow, título, descrição e ações.
- `SectionCard`, `StatCard`, `ProgressDisplay`, `EmptyState`, `WorkflowStepper`, `Icon` e badges como primitives compartilhadas.
- Tabelas densas usam `table-wrap` para overflow horizontal controlado; composições em duas colunas quebram para uma coluna em viewport estreita.
- Cores semânticas: cobalt para ação, teal para pronto, âmbar para atenção e vermelho para erro destrutivo.
