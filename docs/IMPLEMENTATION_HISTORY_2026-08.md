---
title: Implementações de agosto de 2026
date: 2026-08-12
tags:
  - project/history
  - product/exams
  - operations/backup
aliases:
  - Dossiê de implementação de agosto
status: active
---

# Implementações de agosto de 2026

Este documento consolida as mudanças realizadas no UniFil Exams entre 3 e 12 de agosto de 2026 e a implantação do backup amplo do servidor. Para decisões arquiteturais, consulte [[DECISIONS]]; para comandos operacionais completos de recuperação, consulte [[SERVER_ALL_SYSTEMS_BACKUP]].

> [!info] Escopo
> O histórico registra o comportamento entregue, os dados persistidos, as rotas relevantes, a implantação e as evidências de validação. Valores secretos, tokens OAuth e a senha Restic nunca são reproduzidos na documentação.

## Resumo do produto entregue

### Banco e edição de questões

- Imagens de questões passaram a ser servidas corretamente pelo runtime Docker por rotas dinâmicas.
- A visualização individual ganhou navegação **Anterior** e **Próxima** dentro da disciplina.
- A edição mostra a imagem atual em preview grande logo após o enunciado; o campo de upload permanece dedicado à substituição.
- A seleção coletiva do banco permite aplicar ou remover uma área temática sem alterar o conteúdo das questões.
- A interface acadêmica foi reorganizada no fluxo `ORGANIZAR → REVISAR → CRIAR → ENTREGAR`, com navegação responsiva, paleta `Ctrl/Cmd + K`, tema e sidebar persistidos.

### Montagem da prova

- Ao trocar disciplina ou área temática, as quantidades de objetiva, V/F, numérica e dissertativa são sincronizadas com o máximo auditado disponível; um tipo sem questões recebe `0`.
- Cada tipo possui preferência persistida de largura:

| Tipo | Padrão | Opções |
| --- | --- | --- |
| Objetiva | meia página/coluna | `column` ou `full` |
| Verdadeiro/falso | meia página/coluna | `column` ou `full` |
| Numérica | meia página/coluna | `column` ou `full` |
| Dissertativa | página inteira | `column` ou `full` |

- Na edição de uma prova já criada, o professor vê previews maiores e pode alterar a largura de questões específicas sem perder a preferência inicial.
- Dissertativas com `answerLines=0` não geram linhas, permitindo espaço livre para desenho; continuam podendo ocupar meia página.
- V/F e numérica possuem apresentação diferente: V/F mostra escolhas desmarcadas; numérica mostra campo de resposta rotulado.
- A opção **Permitir dividir questões objetivas longas entre páginas** é explícita e desativada por padrão. Quando ativada, enunciado e alternativas são medidos; um bloco inicial de alternativas pode ficar na página atual e o restante segue na próxima, preservando letras e ordem embaralhada.
- V/F, numéricas, dissertativas, tabelas e estruturas não suportadas permanecem atômicas e não são cortadas.
- A paginação uniforme entre sets e a última folha reservada ao gabarito continuam usando o mesmo cálculo de páginas.

### Instruções da prova

A primeira página recebe instruções editáveis. O texto padrão explica:

- como responder objetiva, verdadeiro/falso, numérica e dissertativa;
- que todas as respostas devem ser preenchidas no gabarito da última folha;
- que rasuras na prova são permitidas;
- que somente a resposta final registrada na folha de respostas será considerada.

### Edição, versões e inativação

- Provas exportadas podem ser reabertas em `/exams/[id]/edit`.
- Salvar cria um snapshot imutável com número sequencial e nota de alteração.
- Cada versão preserva título, instituição, instruções, layouts, divisão de questões, sets, ordem de questões, ordem de alternativas e respostas corretas.
- Preview, PDF, CSV, mapa de rastreabilidade e PNG podem ser baixados para uma versão histórica específica por `?version=N`.
- Restaurar uma versão antiga não apaga o histórico: cria uma nova versão a partir daquele snapshot.
- Provas são inativadas em vez de removidas definitivamente. A listagem permite filtrar por status e reativar uma prova inativa.

### Importação orientada por LLM

- O formulário de importação foi movido para o topo da página.
- O professor informa o assunto/tema e as quantidades desejadas de objetiva, V/F, numérica e dissertativa; `0` desativa o tipo.
- `buildImportPrompt()` é a única fonte do prompt copiado/baixado.
- O prompt repete o tema nas regras de escopo, raciocínio, distratores, diversidade e fidelidade ao material.
- A LLM é instruída a retornar exclusivamente um arquivo JSON, sem Markdown, CSV, comentários ou texto adicional.
- O fim do mesmo Markdown contém o template JSON completo, permitindo enviar um único arquivo de orientações.
- O contrato permanece `{version, exportedAt, questions:[...]}` e cada questão usa exatamente nove campos.
- JSON é o formato recomendado para LLM; CSV continua disponível para edição tabular.

Detalhes do contrato: [[IMPORT_QUESTIONS]].

### Rastreabilidade e EvalBee

- O mapa `/api/csv/exam/[examId]/trace` cria uma linha para cada posição impressa em cada set.
- A chave estável é `examId:setLabel:position`.
- O CSV associa posição do aluno, set, versão, ID original da questão, tipo, área temática, resposta exibida e embaralhamento das alternativas.
- Isso permite cruzar o resultado do EvalBee com a questão exata do banco mesmo quando questões e alternativas foram aleatorizadas.
- A ordem do arquivo é determinística: label do set e posição armazenada, iniciando em 1.

### Gabaritos e exportações

- O gabarito completo segue a ordem e o embaralhamento do **Set A**, evitando divergência entre gabarito rápido e completo.
- CSV, matriz, rastreabilidade e PNG históricos usam o snapshot da versão selecionada.
- Respostas verdadeiro/falso são exportadas como `True` e `False`, nunca `V` e `F`.
- Dissertativas usam `-` nos gabaritos objetivos.
- Cada set pode baixar um PNG de alta resolução com identificação da prova/set/versão, resposta correta, ID da questão do banco e justificativa. O arquivo serve para anexar posteriormente à vista de prova.
- O PNG não reutiliza o estado atual quando uma versão histórica foi selecionada.

Detalhes operacionais: [[EXPORTS_EVALBEE]].

## Backup amplo do servidor

### Arquitetura implantada

O pacote ativo está em `ops/system-backup/` e substitui operacionalmente o backup antigo exclusivo do UniFil Exams. Ele usa Restic para criptografia e deduplicação e rclone para armazenar em:

`unifil-drive:Servidor-Eron/backup-restic`

O job executa como serviço `systemd --user`, sem `sudo`, com `linger` habilitado. O timer `server-all-systems-backup.timer` roda diariamente às **03:30 em `America/Sao_Paulo`**, é persistente e possui atraso aleatório de até 10 minutos.

### Cobertura confirmada

| Grupo | Conteúdo |
| --- | --- |
| UniFil Exams | SQLite consistente, uploads e gabaritos |
| Canva API | SQLite consistente e dados persistentes, excluindo DB/WAL/SHM vivos da cópia de arquivos |
| Grade App | banco do contêiner, volumes ativo e histórico, duas cópias host, estado e análises |
| Eron Dashboard | SQLite consistente e dados persistentes |
| Mirror | SQLite legado e configuração necessária à recuperação |
| Supabase | bancos conectáveis `postgres` e `_supabase`, globais, storage, functions, snippets e configurações |
| Configurações | allowlist explícita de compose, `.env` e Caddyfile necessários à recuperação |

O `rclone.conf` e a senha Restic não entram no snapshot criptografado.

### Retenção

- 14 snapshots diários;
- 8 semanais;
- 12 mensais;
- `prune` permanece desativado até existir histórico suficiente e validação operacional continuada.

### Senha e cópias de recuperação

> [!danger] Decisão consciente do proprietário
> Sem a senha Restic, os snapshots são irrecuperáveis. Por solicitação explícita do proprietário, existe também uma cópia **em texto puro** no mesmo Google Drive. Qualquer pessoa com acesso a esse arquivo e ao repositório poderá descriptografar os backups.

As três cópias atuais são:

- servidor: `~/.config/server-backup/restic-password`, modo `0600`;
- Windows: `C:\Users\eronp\Documents\UniFil-Backup-Recovery\restic-password.txt`, ACL restrita ao usuário e SYSTEM;
- Google Drive: `Servidor-Eron/RECUPERACAO-NAO-APAGAR/restic-password.txt`, texto puro.

O upload para o Drive foi validado por leitura de retorno e comparação de conteúdo, sem imprimir a senha em logs.

### Primeiro snapshot e restauração comprovada

- Snapshot: `613b2855f385a0551a4934d67088eb9f1a34e0a5c1d5d1759cee406a6c58b033`.
- Estado do health check: `healthy`.
- Metadados Restic: sem erros.
- Restauração temporária: 986,932 MiB.
- Checksums conferidos: 15.
- SQLite validados com `PRAGMA integrity_check`: 9.
- Dumps PostgreSQL validados com `pg_restore --list`: 2.
- `globals.sql`: presente e não vazio.
- Dados vivos: não alterados.
- Diretório temporário: removido automaticamente.
- Pico da execução corrigida: 295,6 MiB, sem swap.

### Incidente de memória durante a validação

Às 19:40–19:58 UTC de 12 de agosto, tentativas iniciais de verificação elevaram o uso de RAM e swap. O alerta Netdata `used_swap` de **77,6% às 19:53:44 UTC** corresponde à segunda tentativa.

Causa raiz: o script declarava uma função shell `restic()` e também resolvia `RESTIC_BIN=restic`. A função chamava o próprio nome recursivamente, aumentando memória até o limite do cgroup.

Proteções e resultado:

- as tentativas foram isoladas por `systemd-run` com limites de RAM, swap, CPU e prioridade de I/O;
- apenas as unidades de teste foram encerradas pelo OOM killer;
- aplicação e contêineres continuaram ativos e responderam HTTP 200;
- o wrapper foi renomeado para `run_restic()`;
- foi adicionado teste de regressão para o caso do comando simples `restic`;
- a execução corrigida terminou com pico de 295,6 MiB e zero swap.

A swap permaneceu ocupada depois do pico porque o Linux não traz páginas inativas de volta à RAM sem necessidade. A observação posterior mostrou `memory PSI` zerado e quase nenhuma atividade de swap, portanto não havia pressão ativa. O maior ocupante residual observado foi o LanguageTool/Java, com aproximadamente 1 GiB de páginas antigas na swap; isso não significa 1 GiB de atividade ou crescimento atual.

### Rate limit do Google Drive

Durante a restauração, a API do Drive respondeu temporariamente com `rateLimitExceeded`. O rclone aplicou retry automático e a operação concluiu sem intervenção e sem perda de dados.

### Código e operação

- Motor: `ops/system-backup/backup-all-systems.sh`.
- Instalação: `ops/system-backup/install-system-backup.sh`.
- Saúde: `ops/system-backup/check-backup-health.sh`.
- Verificação: `ops/system-backup/verify-system-backup.sh`.
- Restauração apenas para staging: `ops/system-backup/restore-system-backup.sh`.
- Serviço/timer: `ops/system-backup/server-all-systems-backup.{service,timer}`.
- Configuração exemplo: `ops/system-backup/system-backup.env.example`.
- Runbook completo: [[SERVER_ALL_SYSTEMS_BACKUP]].

> [!warning] Limite de automação
> O script de restauração somente extrai para staging seguro. Substituir dados vivos exige janela de manutenção, parada manual apenas do serviço afetado, cópia de rollback, validação e aceite do proprietário.

## Implantação e evidências

- Mudanças do produto foram publicadas no branch `main` e implantadas no servidor.
- O checkout remoto foi alinhado ao commit `51b4e69` após a correção do verificador.
- Testes completos do pacote de prova chegaram a 96 testes aprovados no ciclo de layouts; verificações focadas posteriores cobriram importação, versões, CSVs, rastreabilidade e PNG.
- Os três harnesses Bash do backup passaram localmente e no Ubuntu remoto.
- O harness de verificação/restauração possui 10 cenários após o teste de regressão da recursão.
- O timer e o health check foram confirmados ativos após a restauração real.

## Commits principais

| Commit | Entrega |
| --- | --- |
| `e3ceb36` | layout por tipo e máximos por área |
| `3903552` | divisão opcional de objetivas entre páginas |
| `a813632` | prompt de importação e mapa de rastreabilidade |
| `04fdde5` | tema contextual no prompt |
| `135d4e9` | quantidades por tipo e template JSON completo |
| `bf545b6` | formulário de importação no topo |
| `211ac63` | edição e versões imutáveis de provas |
| `7513754` | largura individual e exportações históricas |
| `c883fb7` | PNG comentado do gabarito |
| `fe7eb58` | motor de backup amplo |
| `7002b33` | verificação e runbook de restauração |
| `87f98be` | detecção segura de repositório Restic ausente |
| `51b4e69` | correção da recursão no verificador |

## Próximas verificações operacionais

- acompanhar diariamente `check-backup-health.sh` e o alerta do Netdata;
- confirmar que o primeiro ciclo automático das 03:30 cria novo snapshot;
- manter a cópia da senha no Windows mesmo existindo a cópia no Drive;
- não executar `prune` durante investigação de falha, perda de senha ou restauração;
- realizar periodicamente uma restauração para staging e registrar o snapshot validado.
