import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getChangedFiles, getPr } from "./pullRequest.js";
import { denied, isRepoAllowed } from "./allowlist.js";
import { ok, toErrorContent } from "./response.js";
import type { CacheClient } from "../cache.js";
import { withCache } from "../cache.js";

export function registerPullRequestTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
  cache: CacheClient,
  ttl: { prs: number },
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
    async ({ repo, pr_number: prNumber }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await withCache(
          cache,
          `get_pr:${org}:${repo}:${prNumber}`,
          ttl.prs,
          () => getPr(octokit, org, repo, prNumber),
        );
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
    async ({ repo, pr_number: prNumber }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await withCache(
          cache,
          `get_changed_files:${org}:${repo}:${prNumber}`,
          ttl.prs,
          () => getChangedFiles(octokit, org, repo, prNumber),
        );
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );
}
