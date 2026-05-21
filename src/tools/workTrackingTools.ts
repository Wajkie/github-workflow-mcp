import type { Octokit } from "@octokit/rest";
import { getActiveWork, getIssue, searchIssues } from "./workTracking.js";

export const WORK_TRACKING_TOOL_DEFS = [
  {
    name: "get_active_work",
    description:
      "Return open pull requests and issues assigned to the authenticated user across allowed repositories.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_issue",
    description:
      "Get title, body, labels, assignees, and state for a single issue. Does not include comment history.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository name (without owner prefix)" },
        issue_number: { type: "number", description: "Issue number" },
      },
      required: ["repo", "issue_number"],
    },
  },
  {
    name: "search_issues",
    description:
      "Search issues in a repository using GitHub query syntax. Returns up to 20 results per page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository name (without owner prefix)" },
        query: { type: "string", description: "GitHub issue search query" },
        page: { type: "number", description: "Page number (default: 1)" },
      },
      required: ["repo", "query"],
    },
  },
];

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export async function handleWorkTrackingTool(
  name: string,
  args: Record<string, unknown>,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
): Promise<ReturnType<typeof ok> | null> {
  switch (name) {
    case "get_active_work": {
      const data = await getActiveWork(octokit, org, allowedRepos);
      return ok(data);
    }
    case "get_issue": {
      const { repo, issue_number } = args as { repo: string; issue_number: number };
      const data = await getIssue(octokit, org, String(repo), Number(issue_number));
      return ok(data);
    }
    case "search_issues": {
      const { repo, query, page } = args as {
        repo: string;
        query: string;
        page?: number;
      };
      const data = await searchIssues(
        octokit,
        org,
        String(repo),
        String(query),
        page ? Number(page) : 1,
      );
      return ok(data);
    }
    default:
      return null;
  }
}
