import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getActiveWork, getIssue, searchIssues } from "./workTracking.js";
import { denied, isRepoAllowed } from "./allowlist.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerWorkTrackingTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
) {
  server.registerTool(
    "get_active_work",
    {
      description:
        "Return open pull requests and issues assigned to the authenticated user across allowed repositories.",
      inputSchema: {},
    },
    async () => {
      const data = await getActiveWork(octokit, org, allowedRepos);
      return ok(data);
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
    async ({ repo, issue_number }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      const data = await getIssue(octokit, org, repo, issue_number);
      return ok(data);
    },
  );

  server.registerTool(
    "search_issues",
    {
      description:
        "Search issues in a repository using GitHub query syntax. Returns up to 20 results per page.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        query: z.string().describe("GitHub issue search query"),
        page: z.number().optional().describe("Page number (default: 1)"),
      },
    },
    async ({ repo, query, page }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      const data = await searchIssues(octokit, org, repo, query, page ?? 1);
      return ok(data);
    },
  );
}
