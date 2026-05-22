import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getReleaseStatus, getRecentDeployments } from "./release.js";
import { denied, isRepoAllowed } from "./allowlist.js";
import { ok, toErrorContent } from "./response.js";

export function registerReleaseTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
) {
  server.registerTool(
    "get_release_status",
    {
      description:
        "Get the latest release for a repository — tag name, publish date, draft status, and a summary of the release notes. Use to check what version is currently live.",
      inputSchema: { repo: z.string().describe("Repository name (without owner prefix)") },
    },
    async ({ repo }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await getReleaseStatus(octokit, org, repo);
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "get_recent_deployments",
    {
      description:
        "Get the last 10 GitHub Actions workflow runs for a repository — name, status, conclusion, and trigger. Use to check CI health or confirm a deployment completed.",
      inputSchema: { repo: z.string().describe("Repository name (without owner prefix)") },
    },
    async ({ repo }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const runs = await getRecentDeployments(octokit, org, repo);
        return ok({ runs });
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );
}
