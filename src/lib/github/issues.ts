import { execSync } from "child_process";

export interface GitHubRepoTarget {
  owner: string;
  repo: string;
  slug: string;
}

export interface GitHubIssueRuntimeConfig {
  enabled: boolean;
  repo: GitHubRepoTarget | null;
  labels: string[];
  reason?: string;
}

let cachedRepoTarget: GitHubRepoTarget | null | undefined;

export function parseGitHubRepoFromRemoteUrl(url: string): GitHubRepoTarget | null {
  const trimmed = url.trim();
  const match = trimmed.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i);
  if (!match?.[1] || !match[2]) return null;
  const owner = match[1];
  const repo = match[2];
  return {
    owner,
    repo,
    slug: `${owner}/${repo}`,
  };
}

function detectRepoTarget(): GitHubRepoTarget | null {
  if (cachedRepoTarget !== undefined) return cachedRepoTarget;

  const explicitSlug = process.env.GITHUB_ISSUES_REPO || process.env.GITHUB_REPOSITORY;
  if (explicitSlug) {
    const [owner, repo] = explicitSlug.split("/");
    if (owner && repo) {
      cachedRepoTarget = { owner, repo, slug: `${owner}/${repo}` };
      return cachedRepoTarget;
    }
  }

  const explicitOwner = process.env.GITHUB_ISSUES_OWNER;
  const explicitRepo = process.env.GITHUB_ISSUES_REPO_NAME || process.env.GITHUB_ISSUES_NAME;
  if (explicitOwner && explicitRepo) {
    cachedRepoTarget = { owner: explicitOwner, repo: explicitRepo, slug: `${explicitOwner}/${explicitRepo}` };
    return cachedRepoTarget;
  }

  try {
    const remote = execSync("git config --get remote.origin.url", {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    cachedRepoTarget = parseGitHubRepoFromRemoteUrl(remote);
    return cachedRepoTarget;
  } catch {
    cachedRepoTarget = null;
    return null;
  }
}

function getLabels(): string[] {
  return (process.env.GITHUB_ISSUES_LABELS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getGitHubIssueRuntimeConfig(): GitHubIssueRuntimeConfig {
  const repo = detectRepoTarget();
  const labels = getLabels();

  if (!repo) {
    return {
      enabled: false,
      repo: null,
      labels,
      reason: "Nao foi possivel descobrir owner/repo do GitHub. Defina GITHUB_ISSUES_REPO.",
    };
  }

  return { enabled: true, repo, labels };
}
