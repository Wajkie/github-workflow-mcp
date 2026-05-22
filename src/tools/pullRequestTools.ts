import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getChangedFiles, getPr, listPullRequests } from "./pullRequest.js";
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
    "list_pull_requests",
    {
      description:
        "List pull requests in a repository. Returns number, title, state, draft flag, head/base branch, author, and URL. Defaults to open PRs. Use before get_pr to find the PR number.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        state: z
          .enum(["open", "closed", "all"])
          .optional()
          .describe("Filter by PR state (default: open)"),
      },
    },
    async ({ repo, state }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await listPullRequests(octokit, org, repo, state ?? "open");
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "get_pr",
    {
      description:
        "Get title, body, state, head/base branch, author, reviewers, labels, and merge status for a pull request. Does not include commit history or file contents — use get_changed_files for the diff.",
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
        "List files changed in a pull request with their status (added/modified/deleted) and patch hunks. Use to inspect what a PR touches without reading full file contents — pair with validate_pr to also get lint results.",
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
