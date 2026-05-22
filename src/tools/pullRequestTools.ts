import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getChangedFiles, getPr } from "./pullRequest.js";
import { denied, isRepoAllowed } from "./allowlist.js";
import { ok, toErrorContent } from "./response.js";

export function registerPullRequestTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
) {
  server.registerTool(
    "get_pr",
    {
      description:
        "Get title, body, state, head/base branch, author, reviewers, labels, and merge status for a pull request. Does not include commit history or file contents.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        pr_number: z.number().describe("Pull request number"),
      },
    },
    async ({ repo, pr_number }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await getPr(octokit, org, repo, pr_number);
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "get_changed_files",
    {
      description:
        "List files changed in a pull request with their status (added/modified/deleted) and patch hunks. Does not return full file contents.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        pr_number: z.number().describe("Pull request number"),
      },
    },
    async ({ repo, pr_number }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await getChangedFiles(octokit, org, repo, pr_number);
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );
}
