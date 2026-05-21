import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getReleaseStatus, getRecentDeployments } from "./release.js";
import { denied, isRepoAllowed } from "./allowlist.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerReleaseTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
) {
  server.registerTool(
    "get_release_status",
    {
      description: "Get the latest release for a repository — tag, publish date, draft status, and release notes summary",
      inputSchema: { repo: z.string().describe("Repository name (without owner prefix)") },
    },
    async ({ repo }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      const data = await getReleaseStatus(octokit, org, repo);
      return ok(data);
    },
  );

  server.registerTool(
    "get_recent_deployments",
    {
      description: "Get the last 10 GitHub Actions workflow runs for a repository — name, status, conclusion, and trigger",
      inputSchema: { repo: z.string().describe("Repository name (without owner prefix)") },
    },
    async ({ repo }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      const runs = await getRecentDeployments(octokit, org, repo);
      return ok({ runs });
    },
  );
}
