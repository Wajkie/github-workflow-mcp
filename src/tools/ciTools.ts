import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getWorkflowRun, getWorkflowRunJobs, getFailedJobLogs, rerunFailedJobs } from "./ci.js";
import { denied, isRepoAllowed } from "./allowlist.js";
import { writeDenied } from "./writeGate.js";
import { ok, toErrorContent } from "./response.js";

export function registerCiTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
  allowWrites: boolean,
) {
  server.registerTool(
    "get_workflow_run",
    {
      description:
        "Get details of a specific GitHub Actions workflow run by ID — status, conclusion, branch, commit SHA, and run URL. Use when you have a run ID and need full detail beyond what get_recent_deployments returns.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        run_id: z.number().describe("Workflow run ID"),
      },
    },
    async ({ repo, run_id: runId }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await getWorkflowRun(octokit, org, repo, runId);
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "get_workflow_run_jobs",
    {
      description:
        "List all jobs in a workflow run with per-step status and conclusion. Use to pinpoint which step failed inside a run.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        run_id: z.number().describe("Workflow run ID"),
      },
    },
    async ({ repo, run_id: runId }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const jobs = await getWorkflowRunJobs(octokit, org, repo, runId);
        return ok({ jobs });
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "get_failed_job_logs",
    {
      description:
        "Fetch the raw log output for a specific workflow job (capped at ~50 KB). Use to read the actual error from a failed job without opening the browser.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        job_id: z.number().describe("Job ID (from get_workflow_run_jobs)"),
      },
    },
    async ({ repo, job_id: jobId }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const logs = await getFailedJobLogs(octokit, org, repo, jobId);
        return ok({ logs });
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "rerun_failed_jobs",
    {
      description:
        "Trigger a rerun of only the failed jobs in a workflow run. Requires ALLOW_WRITES=true. Use after diagnosing a transient CI failure.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        run_id: z.number().describe("Workflow run ID whose failed jobs to rerun"),
      },
    },
    async ({ repo, run_id: runId }) => {
      if (!allowWrites) return writeDenied();
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const data = await rerunFailedJobs(octokit, org, repo, runId);
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );
}
