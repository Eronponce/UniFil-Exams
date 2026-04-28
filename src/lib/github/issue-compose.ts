export function deriveIssueTitle(message: string): string {
  const firstLine =
    message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "Nova issue enviada pelo chat";

  const cleaned = firstLine.replace(/^[-*#>\s]+/, "").trim();
  const base = cleaned.length >= 8 ? cleaned : `Feedback: ${cleaned || "nova issue"}`;
  return base.length > 80 ? `${base.slice(0, 77).trimEnd()}...` : base;
}

export function buildIssueBody(message: string, path?: string): string {
  const parts = [
    "## Mensagem enviada pelo chat local",
    "",
    message.trim(),
    "",
    "## Contexto",
    "",
    "- origem: widget local UniFil Exams",
    `- rota: ${path || "(nao informada)"}`,
    `- criado em: ${new Date().toISOString()}`,
  ];
  return parts.join("\n");
}

export function buildGitHubIssueComposeUrl(params: {
  repoSlug: string;
  message: string;
  path?: string;
  labels?: string[];
}): string {
  const query = new URLSearchParams({
    title: deriveIssueTitle(params.message),
    body: buildIssueBody(params.message, params.path),
  });

  const labels = (params.labels ?? []).map((label) => label.trim()).filter(Boolean);
  if (labels.length > 0) {
    query.set("labels", labels.join(","));
  }

  return `https://github.com/${params.repoSlug}/issues/new?${query.toString()}`;
}
