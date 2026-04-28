import { describe, expect, it } from "vitest";
import { parseGitHubRepoFromRemoteUrl } from "@/lib/github/issues";
import { buildGitHubIssueComposeUrl, deriveIssueTitle } from "@/lib/github/issue-compose";

describe("parseGitHubRepoFromRemoteUrl", () => {
  it("parses https remotes", () => {
    expect(parseGitHubRepoFromRemoteUrl("https://github.com/Eronponce/UniFil-Exams.git")).toEqual({
      owner: "Eronponce",
      repo: "UniFil-Exams",
      slug: "Eronponce/UniFil-Exams",
    });
  });

  it("parses ssh remotes", () => {
    expect(parseGitHubRepoFromRemoteUrl("git@github.com:Eronponce/UniFil-Exams.git")).toEqual({
      owner: "Eronponce",
      repo: "UniFil-Exams",
      slug: "Eronponce/UniFil-Exams",
    });
  });

  it("returns null for non-github remotes", () => {
    expect(parseGitHubRepoFromRemoteUrl("https://example.com/org/repo.git")).toBeNull();
  });
});

describe("deriveIssueTitle", () => {
  it("uses the first non-empty line", () => {
    expect(deriveIssueTitle("\n\nBug no PDF final\nsegunda linha")).toBe("Bug no PDF final");
  });

  it("truncates very long titles", () => {
    const title = deriveIssueTitle("x".repeat(120));
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("...")).toBe(true);
  });
});

describe("buildGitHubIssueComposeUrl", () => {
  it("builds a prefilled GitHub issue URL", () => {
    const url = buildGitHubIssueComposeUrl({
      repoSlug: "Eronponce/UniFil-Exams",
      message: "Bug no PDF final\nsegunda linha",
      path: "/exports",
      labels: ["from-app"],
    });
    expect(url).toContain("https://github.com/Eronponce/UniFil-Exams/issues/new?");
    expect(url).toContain("title=Bug+no+PDF+final");
    expect(url).toContain("labels=from-app");
    expect(url).toContain("%2Fexports");
  });
});
