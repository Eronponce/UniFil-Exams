export default function SettingsPage() {
  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL ?? "qwen2.5:latest";
  const claudeKey = process.env.CLAUDE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  function status(key: string | undefined) {
    return key ? "✓ Configurado" : "✗ Ausente";
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem" }}>Provedores IA</h2>
        <table className="table">
          <tbody>
            <tr>
              <td><strong>Ollama URL</strong></td>
              <td><code>{ollamaUrl}</code></td>
            </tr>
            <tr>
              <td><strong>Ollama Model</strong></td>
              <td><code>{ollamaModel}</code></td>
            </tr>
            <tr>
              <td><strong>Claude API Key</strong></td>
              <td style={{ color: claudeKey ? "var(--success)" : "var(--danger)" }}>{status(claudeKey)}</td>
            </tr>
            <tr>
              <td><strong>Gemini API Key</strong></td>
              <td style={{ color: geminiKey ? "var(--success)" : "var(--danger)" }}>{status(geminiKey)}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "1rem" }}>
          Edite <code>.env.local</code> na raiz do projeto para configurar chaves e URLs. Reinicie o servidor após alterações.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem" }}>Armazenamento Local</h2>
        <table className="table">
          <tbody>
            <tr>
              <td><strong>Banco de dados</strong></td>
              <td><code>data/unifil-exams.db</code></td>
            </tr>
            <tr>
              <td><strong>Imagens de questões</strong></td>
              <td><code>public/uploads/questions/</code></td>
            </tr>
            <tr>
              <td><strong>Imagens EvalBee</strong></td>
              <td><code>public/uploads/evalbee/</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
