import type { Octokit } from "@octokit/rest";
import { sanitizeContent } from "../sanitize.js";

const LOG_CAP = 50_000;

export async function getWorkflowRun(octokit: Octokit, org: string, repo: string, runId: number) {
  const { data } = await octokit.rest.actions.getWorkflowRun({ owner: org, repo, run_id: runId });
  return {
    id: data.id,
    name: data.name ?? null,
    status: data.status,
    conclusion: data.conclusion ?? null,
    event: data.event,
    branch: data.head_branch ?? null,
    sha: data.head_sha,
    triggered_by: data.triggering_actor?.login ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
    url: data.html_url,
  };
}

export async function getWorkflowRunJobs(octokit: Octokit, org: string, repo: string, runId: number) {
  const { data } = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: org,
    repo,
    run_id: runId,
    filter: "all",
  });
  return data.jobs.map((job) => ({
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion ?? null,
    started_at: job.started_at ?? null,
    completed_at: job.completed_at ?? null,
    steps: (job.steps ?? []).map((step) => ({
      name: step.name,
      status: step.status,
      conclusion: step.conclusion ?? null,
      number: step.number,
    })),
  }));
}

export async function getFailedJobLogs(octokit: Octokit, org: string, repo: string, jobId: number) {
  const response = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
    owner: org,
    repo,
    job_id: jobId,
  });
  const raw = typeof response.data === "string" ? response.data : String(response.data);
  const text = sanitizeContent(raw);
  // Return the tail so the failure message is always included
  return text.length > LOG_CAP ? text.slice(-LOG_CAP) : text;
}

export async function rerunFailedJobs(octokit: Octokit, org: string, repo: string, runId: number) {
  await octokit.rest.actions.reRunWorkflowFailedJobs({ owner: org, repo, run_id: runId });
  return { queued: true, run_id: runId };
}
