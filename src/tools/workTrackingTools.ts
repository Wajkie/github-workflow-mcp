import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getActiveWork, getIssue, searchIssues } from "./workTracking.js";
import { denied, isRepoAllowed } from "./allowlist.js";
import { ok, toErrorContent } from "./response.js";
import type { CacheClient } from "../cache.js";
import { withCache } from "../cache.js";

export function registerWorkTrackingTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
  cache: CacheClient,
  ttl: { issues: number },
) {
  server.registerTool(
    "get_active_work",
    {
      description:
        "Return open pull requests and issues assigned to the authenticated user across allowed repositories.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await withCache(cache, `get_active_work:${org}`, ttl.issues, () =>
          getActiveWork(octokit, org, allowedRepos),
        );
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "get_issue",
    {
      description:
        "Get title, body, labels, assignees, and state for a single issue. Does not include comment history.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        issue_number: z.number().describe("Issue number"),
      },
    },
    async ({ repo, issue_number: issueNumber }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await withCache(
          cache,
          `get_issue:${org}:${repo}:${issueNumber}`,
          ttl.issues,
          () => getIssue(octokit, org, repo, issueNumber),
        );
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "search_issues",
    {
      description:
        "Search issues in a repository using GitHub query syntax. Returns up to 20 results per page.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        query: z
          .string()
          .describe("GitHub issue search query")
          .refine((q) => !/(?:^|\s)\w+:(?!\/)/.test(q), {
            message: "Query must not contain GitHub search qualifier syntax (e.g. repo:, org:)",
          }),
        page: z.number().optional().describe("Page number (default: 1)"),
      },
    },
    async ({ repo, query, page }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const resolvedPage = page ?? 1;
        const data = await withCache(
          cache,
          `search_issues:${org}:${repo}:${query}:${resolvedPage}`,
          ttl.issues,
          () => searchIssues(octokit, org, repo, query, resolvedPage),
        );
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );
}
