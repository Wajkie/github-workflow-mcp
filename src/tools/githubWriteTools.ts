import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { createBranch, createPullRequest, mergePr, requestReview } from "./githubWrite.js";
import { denied, isRepoAllowed } from "./allowlist.js";
import { writeDenied } from "./writeGate.js";
import type { AuditLogger } from "../audit.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerGithubWriteTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
  allowWrites: boolean,
  auditLog: AuditLogger = async () => {},
  actor = "unknown",
) {
  server.registerTool(
    "create_branch",
    {
      description: "Create a new branch from a base ref in a repository.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        branch_name: z.string().describe("Name of the new branch"),
        base: z.string().describe("Branch, tag, or SHA to branch from"),
      },
    },
    async ({ repo, branch_name, base }) => {
      if (!allowWrites) return writeDenied();
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await createBranch(octokit, org, repo, branch_name, base);
        await auditLog({ tool: "create_branch", inputs: { repo, branch_name, base }, outcome: "success", actor });
        return ok(data);
      } catch (err) {
        await auditLog({ tool: "create_branch", inputs: { repo, branch_name, base }, outcome: "error", error: String(err), actor });
        throw err;
      }
    },
  );

  server.registerTool(
    "create_pull_request",
    {
      description: "Open a pull request in a repository.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        title: z.string().describe("Pull request title"),
        body: z.string().describe("Pull request body"),
        head: z.string().describe("Branch containing the changes"),
        base: z.string().describe("Branch to merge into"),
      },
    },
    async ({ repo, title, body, head, base }) => {
      if (!allowWrites) return writeDenied();
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await createPullRequest(octokit, org, repo, title, body, head, base);
        await auditLog({ tool: "create_pull_request", inputs: { repo, title, head, base }, outcome: "success", actor });
        return ok(data);
      } catch (err) {
        await auditLog({ tool: "create_pull_request", inputs: { repo, title, head, base }, outcome: "error", error: String(err), actor });
        throw err;
      }
    },
  );

  server.registerTool(
    "request_review",
    {
      description: "Add reviewers to a pull request.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        pr_number: z.number().describe("Pull request number"),
        reviewers: z.array(z.string()).describe("GitHub usernames to request review from"),
      },
    },
    async ({ repo, pr_number, reviewers }) => {
      if (!allowWrites) return writeDenied();
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await requestReview(octokit, org, repo, pr_number, reviewers);
        await auditLog({ tool: "request_review", inputs: { repo, pr_number, reviewers }, outcome: "success", actor });
        return ok(data);
      } catch (err) {
        await auditLog({ tool: "request_review", inputs: { repo, pr_number, reviewers }, outcome: "error", error: String(err), actor });
        throw err;
      }
    },
  );

  server.registerTool(
    "merge_pr",
    {
      description: "Merge a pull request. Defaults to squash merge.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        pr_number: z.number().describe("Pull request number"),
        method: z
          .enum(["squash", "merge", "rebase"])
          .optional()
          .describe("Merge method (default: squash)"),
      },
    },
    async ({ repo, pr_number, method }) => {
      if (!allowWrites) return writeDenied();
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await mergePr(octokit, org, repo, pr_number, method);
        await auditLog({ tool: "merge_pr", inputs: { repo, pr_number, method }, outcome: "success", actor });
        return ok(data);
      } catch (err) {
        await auditLog({ tool: "merge_pr", inputs: { repo, pr_number, method }, outcome: "error", error: String(err), actor });
        throw err;
      }
    },
  );
}
