import { NextResponse } from "next/server";
import { getGitHubIssueRuntimeConfig } from "@/lib/github/issues";

export async function GET() {
  const config = getGitHubIssueRuntimeConfig();
  return NextResponse.json({
    enabled: config.enabled,
    repo: config.repo?.slug ?? null,
    labels: config.labels,
    reason: config.reason ?? null,
  });
}
