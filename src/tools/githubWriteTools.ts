import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { createBranch, createPullRequest, mergePr, requestReview } from "./githubWrite.js";
import { denied, isRepoAllowed } from "./allowlist.js";
import { writeDenied } from "./writeGate.js";
import type { AuditLogger } from "../audit.js";
import { ok } from "./response.js";

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
      description:
        "Create a new branch from a base ref. Requires ALLOW_WRITES=true. Use this as the first step before writing files or opening a pull request.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        branch_name: z
          .string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9._\-/]*$/, "Branch name may only contain letters, numbers, hyphens, underscores, dots, and slashes")
          .describe("Name of the new branch"),
        base: z.string().describe("Branch, tag, or SHA to branch from"),
      },
    },
    async ({ repo, branch_name: branchName, base }) => {
      if (!allowWrites) return writeDenied();
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await createBranch(octokit, org, repo, branchName, base);
        await auditLog({ tool: "create_branch", inputs: { repo, branch_name: branchName, base }, outcome: "success", actor });
        return ok(data);
      } catch (err) {
        await auditLog({ tool: "create_branch", inputs: { repo, branch_name: branchName, base }, outcome: "error", error: String(err), actor });
        throw err;
      }
    },
  );

  server.registerTool(
    "create_pull_request",
    {
      description:
        "Open a pull request between two branches. Requires ALLOW_WRITES=true. Use after pushing commits to a branch created with create_branch.",
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
      description:
        "Add reviewer(s) to an open pull request. Requires ALLOW_WRITES=true. Use after create_pull_request when the PR is ready for human review.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        pr_number: z.number().describe("Pull request number"),
        reviewers: z.array(z.string()).describe("GitHub usernames to request review from"),
      },
    },
    async ({ repo, pr_number: prNumber, reviewers }) => {
      if (!allowWrites) return writeDenied();
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await requestReview(octokit, org, repo, prNumber, reviewers);
        await auditLog({ tool: "request_review", inputs: { repo, pr_number: prNumber, reviewers }, outcome: "success", actor });
        return ok(data);
      } catch (err) {
        await auditLog({ tool: "request_review", inputs: { repo, pr_number: prNumber, reviewers }, outcome: "error", error: String(err), actor });
        throw err;
      }
    },
  );

  server.registerTool(
    "merge_pr",
    {
      description:
        "Merge a pull request. Requires ALLOW_WRITES=true. Only call when the PR is approved and CI checks have passed. Defaults to squash merge.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        pr_number: z.number().describe("Pull request number"),
        method: z
          .enum(["squash", "merge", "rebase"])
          .optional()
          .describe("Merge method (default: squash)"),
      },
    },
    async ({ repo, pr_number: prNumber, method }) => {
      if (!allowWrites) return writeDenied();
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await mergePr(octokit, org, repo, prNumber, method);
        await auditLog({ tool: "merge_pr", inputs: { repo, pr_number: prNumber, method }, outcome: "success", actor });
        return ok(data);
      } catch (err) {
        await auditLog({ tool: "merge_pr", inputs: { repo, pr_number: prNumber, method }, outcome: "error", error: String(err), actor });
        throw err;
      }
    },
  );
}
