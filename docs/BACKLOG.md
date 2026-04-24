# Backlog — UniFil Exams

Data: 2026-04-22

---

## US-01 · IA decide a dificuldade no import em lote

**Como** professor, **quero** que a IA classifique a dificuldade de cada questão importada,
**para** não precisar definir manualmente quando importo várias questões de uma vez.

**Critérios de aceite:**
- Remover seletor de dificuldade da tela Importar IA
- Prompt de lote inclui campo `difficulty` (`easy|medium|hard`) no schema JSON
- Parser extrai `difficulty` por questão
- Salvar cada questão com sua dificuldade sugerida pela IA

**Status:** ✅ Implementado

---

## US-02 · Seleção de questões por disciplina na montagem de prova

**Como** professor, **quero** selecionar a disciplina na montagem de prova e ver todas as questões auditadas dessa disciplina,
**para** escolher quais entram na prova com visibilidade completa.

**Critérios de aceite:**
- Seletor de disciplina filtra a lista de questões auditadas
- Lista mostra enunciado truncado + área temática + dificuldade
- Checkboxes individuais para seleção
- Filtro adicional por área temática dentro da disciplina

**Status:** ✅ Implementado

---

## US-03 · Área temática nas questões

**Como** professor, **quero** classificar cada questão com uma área temática (ex: "Herança", "POO Básico"),
**para** montar provas temáticas (só área A, ou áreas A+B+C+D).

**Critérios de aceite:**
- Campo `área temática` (texto livre) em criar/editar questão
- IA sugere área temática ao importar em lote
- Filtro por área temática na montagem de prova
- Filtro por área temática no banco de questões

**Status:** ✅ Implementado

---

## US-04 · Campo "quantidade de sets" e gabarito único no PDF

**Como** professor, **quero** informar o número de sets (ex: 3) e receber um único PDF com todos os sets + gabarito final,
**para** simplificar o processo de exportação e impressão.

**Critérios de aceite:**
- Campo numérico "Quantidade de sets" substitui o campo de labels
- Labels geradas automaticamente (A, B, C…)
- PDF combinado: Set A + Set B + Set C + gabarito em tabela (Q | Set A | Set B | Set C)
- Um único botão de download por prova (não um por set)

**Status:** ✅ Implementado

---

## US-05 · Cabeçalho customizável e logo da UniFil no PDF

**Como** professor, **quero** adicionar o nome da instituição e a logo da UniFil no cabeçalho do PDF,
**para** que as provas tenham identidade visual oficial.

**Critérios de aceite:**
- Campo "Instituição" na criação da prova (padrão: "UniFil - Centro Universitário Filadélfia")
- Logo: se `public/unifil-logo.png` existir, é incluída no cabeçalho de todas as páginas do PDF
- Logo aparece no canto superior esquerdo, ao lado do nome da instituição e título da prova

**Status:** ✅ Implementado

---

## US-06 · Gabarito sempre na última página (smart placement)

**Como** professor, **quero** que o gabarito seja sempre a última página do PDF,
**para** facilitar o recorte em impressão frente-e-verso.

**Critérios de aceite:**
- Conta o total de páginas de questões (todos os sets)
- Se o total for ímpar → insere página em branco antes do gabarito
- Se for par → gabarito diretamente no final
- Gabarito nunca fica "virado" no verso de uma questão

**Status:** ✅ Implementado

---

## US-12 · Justificativa para questões dissertativas

**Como** professor, **quero** registrar o gabarito esperado (justificativa) para questões dissertativas,
**para** poder consultar a resposta esperada durante a correção.

**Status:** ✅ Implementado (2026-04-24) — campo `explanation` exposto em todos os fluxos para todos os tipos.

---

## US-13 · Fila de tarefas em memória (auditoria + geração IA)

**Como** professor, **quero** auditar questões e gerar questões por IA sem bloquear a interface,
**para** continuar navegando enquanto as operações processam em background.

**Status:** ✅ Implementado (2026-04-24) — `QueuePanel` fixo no canto inferior direito; dedup; cancel; resultado recuperável.

---

## Backlog Futuro

| ID | Descrição | Prioridade |
|----|-----------|------------|
| US-07 | Paginação automática de questões no PDF (quando há muitas questões que não cabem em 1 página) | Alta |
| US-08 | Upload de logo personalizada por prova (substituir `public/unifil-logo.png`) | Média |
| US-09 | Edição inline do gabarito na tela de exportação | Média |
| US-10 | Exportação de prova em formato DOCX | Baixa |
| US-11 | Banco de questões compartilhado entre disciplinas (cross-discipline) | Baixa |
| US-14 | Smoke manual no navegador: streaming com Ollama/Claude/Gemini reais | Alta |
| US-15 | Validar visualmente PDFs longos com mixes de seção para ajustar density | Média |
| US-16 | Compartilhar configuracao Obsidian `.obsidian/` no GitHub se a equipe quiser padronizar plugins/tema | Baixa |
