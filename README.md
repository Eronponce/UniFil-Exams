# UniFil Exams

Banco de questões objetivas para professores universitários. Permite criar questões manualmente ou via IA, auditar, montar provas com randomização de alternativas e exportar em PDF/CSV.

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
