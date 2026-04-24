# UniFil Exams

Banco local de questões para professores universitários. Suporta questões objetivas, verdadeiro/falso e dissertativas, com criação manual ou via IA, auditoria, montagem de provas, randomização, exportação em PDF/CSV, fila global de tarefas e documentação Obsidian versionada.

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.com/) (para geração de questões com IA local)

## Instalação

```bash
git clone https://github.com/seu-usuario/UniFil-Exams.git
cd UniFil-Exams
npm install
```

## Configuração

Crie o arquivo `.env.local` na raiz do projeto:

```env
# Ollama (IA local — obrigatório para geração de questões)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:latest

# APIs externas (opcional)
CLAUDE_API_KEY=
GEMINI_API_KEY=
```

## Executando

**1. Inicie o Ollama** (necessário para geração de questões com IA):

```bash
ollama serve
```

**2. Baixe o modelo** (apenas na primeira vez):

```bash
ollama pull llama3.2:latest
```

**3. Inicie o servidor de desenvolvimento:**

```bash
npm run dev
```

Acesse em: [http://localhost:3000](http://localhost:3000)

## Funcionalidades

### Banco e IA

- Questões `objetivas`, `verdadeiro_falso` e `dissertativas`
- Geração IA individual e em lote via fila em memória
- Recuperação de resultados por link `?task=...`
- Revisão antes de salvar no banco
- Toasts globais para feedback de sucesso, erro e andamento

### Montagem e exportação

- Seleção manual do pool auditado
- Definição de quantidades por tipo (`objetiva`, `V/F`, `dissertativa`) na prova
- Randomização de ordem das questões e das alternativas quando aplicável
- PDF com seções contínuas, tentando aproveitar a sobra da página anterior
- PDFs de sets com mesma quantidade par de páginas por lote, com páginas vazias antes do gabarito quando necessário
- CSV de gabarito por set
- Upload de logo institucional e imagem de gabarito/EvalBee

| Rota | Descrição |
|------|-----------|
| `/` | Dashboard com estatísticas |
| `/disciplines` | Gerenciar disciplinas |
| `/questions` | Banco de questões (criar, editar, filtrar) |
| `/audit` | Auditar questões antes de usar em provas |
| `/ai` | Gerar questão única com IA |
| `/ai/import` | Importar múltiplas questões via IA a partir de texto |
| `/exams` | Montar provas com randomização de alternativas |
| `/exports` | Exportar provas em PDF e gabarito em CSV |
| `/settings` | Visualizar configuração de provedores IA |

## Outros comandos

```bash
npm test          # Rodar testes
npm run typecheck # Verificar tipos TypeScript
npm run lint      # Verificar qualidade do código
npm run build     # Build de produção
```

## Banco de dados

SQLite local em `data/unifil-exams.db`. Criado automaticamente na primeira execução.

## Documentação Obsidian

As notas em `docs/*.md` fazem parte do projeto e devem ir para o GitHub junto com o código. Comece por [`docs/INDEX.md`](docs/INDEX.md). As notas principais para continuidade são [`docs/PROMPT_T1_T11_STATUS.md`](docs/PROMPT_T1_T11_STATUS.md), [`docs/DECISIONS.md`](docs/DECISIONS.md) e [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md).
