---
title: User Workflows
tags:
  - product/workflows
  - ux
aliases:
  - Fluxos de Usuário
status: active
---

# User Workflows

O UniFil Exams foi organizado para reduzir a troca de contexto do professor. A trilha recomendada é `ORGANIZAR → REVISAR → CRIAR → ENTREGAR`.

## 1. Preparar o espaço

1. Abra `/` e confira os KPIs e o cartão “Continue de onde parou”.
2. Use `/disciplines` para cadastrar ou editar componentes curriculares.
3. Entre em `/questions` para pesquisar o banco; filtros e exportações preservam os parâmetros atuais. Use **Sem área temática** para isolar questões cuja área está ausente.
4. Em desktop, recolha a sidebar se precisar de mais largura; em celular, use o menu móvel.
5. Pressione `Ctrl/Cmd + K` para buscar qualquer destino ou ação sem percorrer o menu.

## 2. Criar questão manual

1. Acesse `/questions/new` ou escolha “Nova questão” na paleta.
2. Escolha a disciplina, dificuldade e tipo.
3. Preencha enunciado, alternativas/resposta, justificativa e linhas de resposta quando aplicável.
4. Na imagem opcional, escolha um arquivo ou cole uma imagem com `Ctrl/Cmd + V`; confira o preview e use **Remover imagem** se necessário.
5. Salve; a questão aparece no banco e, enquanto não auditada, entra na fila de revisão.

## 3. Auditar o banco

1. Abra `/audit` a partir do dashboard ou do menu Conteúdo.
2. Filtre por disciplina, confira o HTML rico, imagem, alternativas e justificativa.
3. Escolha `Auditar`, `Recusar`, `Editar` ou `Excluir`; ações destrutivas mantêm confirmação.
4. Questões auditadas passam a ser elegíveis para montagem. O estado otimista dá resposta imediata e o refresh atualiza os dados do SQLite.
5. Se uma operação em background estiver ativa, acompanhe o dock de atividade; o cancelamento e a recuperação continuam disponíveis.

## 4. Gerar com IA

### Uma questão — `/ai`

1. Escolha disciplina, tipo, provedor/modelo e tema.
2. Envie para a fila; é seguro navegar para outra rota.
3. Retorne pelo link “Ver” do `QueuePanel` ou por `/ai?task=...`.
4. Leia o trace, ajuste o formulário e salve somente depois da revisão humana.

### Lote — `/ai/import`

1. Cole tópicos, enunciados rascunhados ou texto de referência.
2. Envie o lote para a fila e recupere-o por `?task=` se sair da tela.
3. Selecione os itens, ajuste áreas temáticas e confirme o salvamento em lote.

## 5. Importar arquivo

1. Acesse `/questions/importar`.
2. Baixe/copiei o template JSON ou CSV; o prompt de IA da tela usa o mesmo contrato do backend.
3. Escolha a disciplina e carregue `.json` ou `.csv`.
4. Revise o preview, selecione os itens desejados e importe.
5. Em erro de leitura ou validação, corrija o arquivo sem perder a URL nem o restante do fluxo.

## 6. Montar uma avaliação

1. Abra `/exams` e selecione a disciplina.
2. Opcionalmente filtre áreas temáticas e ajuste a seleção de questões auditadas.
3. Defina título, instituição, quantidade de sets, contagem e largura padrão por tipo; marque largura total em questões específicas quando necessário.
4. Para reduzir espaço vazio, marque **Agrupar questões por largura para economizar espaço**. Cada set mantém `objetiva → V/F → numérica → dissertativa` e, dentro de cada tipo, sorteia primeiro `column` e depois `full`.
5. Gere a prova; a ordem gravada no set é usada igualmente na impressão, no gabarito e na rastreabilidade.
6. Em falha de validação, os campos de montagem e a opção compacta são recuperados pelos parâmetros existentes.

## 7. Entregar PDF, CSV e ZIP

1. Em `/exports`, escolha a prova criada.
2. Anexe ou substitua o gabarito EvalBee e ajuste a largura se necessário.
3. Abra o preview HTML A4 para conferir questões, sets e a última página. Imagens acompanham a largura da questão, mas não podem ocupar mais de 25% da área imprimível; fontes muito altas também ficam limitadas a metade da altura da página.
4. Baixe PDF direto, CSV por set/todos os sets e ZIP (um PDF por set).
5. Use o “Gabarito Completo” para uma última conferência antes de imprimir.

## 8. Operar em tela pequena e teclado

- O drawer móvel é aberto/fechado por botão com estado ARIA e overlay clicável.
- Todos os controles têm foco visível; `Esc` fecha a paleta e o drawer quando aplicável.
- Setas e `Enter` operam a paleta; links continuam navegáveis por Tab.
- Tabelas e previews têm overflow controlado; ações não são escondidas em viewport estreita.
- A preferência de tema respeita o sistema e pode ser fixada em claro/escuro.

## Aceite V1

- O professor consegue sair do banco de questões e chegar ao PDF final sem planilha manual.
- Cada set tem PDF próprio e CSV próprio.
- O gabarito acompanha alternativas randomizadas.
- A imagem EvalBee correta aparece na última página do set.
- O redesign não altera URLs, nomes de campos, Server Actions, fila, uploads, APIs nem rotas de impressão.
