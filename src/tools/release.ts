import type { Octokit } from "@octokit/rest";
import { wrapUntrustedContent } from "../sanitize.js";

export async function getReleaseStatus(octokit: Octokit, org: string, repo: string) {
  const { data } = await octokit.rest.repos.getLatestRelease({ owner: org, repo });
  return {
    tag: data.tag_name,
    name: data.name ?? null,
    published_at: data.published_at ?? null,
    draft: data.draft,
    prerelease: data.prerelease,
    body_summary: data.body ? wrapUntrustedContent(data.body.slice(0, 500)) : null,
    url: data.html_url,
  };
}

export async function getRecentDeployments(octokit: Octokit, org: string, repo: string) {
  const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
    owner: org,
    repo,
    per_page: 10,
  });
  return data.workflow_runs.map((run) => ({
    id: run.id,
    name: run.name ?? null,
    status: run.status,
    conclusion: run.conclusion ?? null,
    event: run.event,
    branch: run.head_branch ?? null,
    created_at: run.created_at,
    updated_at: run.updated_at,
    url: run.html_url,
  }));
}
