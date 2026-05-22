import type { Octokit } from "@octokit/rest";
import { sanitizeContent } from "../sanitize.js";

export async function listPullRequests(
  octokit: Octokit,
  org: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
) {
  const { data } = await octokit.rest.pulls.list({
    owner: org,
    repo,
    state,
    per_page: 30,
  });

  return data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: pr.draft ?? false,
    head: pr.head.ref,
    base: pr.base.ref,
    author: pr.user?.login ?? null,
    url: pr.html_url,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
  }));
}

export async function getPr(octokit: Octokit, org: string, repo: string, prNumber: number) {
  const { data } = await octokit.rest.pulls.get({
    owner: org,
    repo,
    pull_number: prNumber,
  });

  return {
    number: data.number,
    title: data.title,
    body: data.body ? sanitizeContent(data.body) : null,
    state: data.state,
    draft: data.draft ?? false,
    head: data.head.ref,
    base: data.base.ref,
    author: data.user?.login ?? null,
    reviewers: (data.requested_reviewers ?? []).map((r) => r.login),
    labels: data.labels.map((l) => l.name ?? ""),
    merged: data.merged,
    mergeable: data.mergeable,
    url: data.html_url,
  };
}

export async function getChangedFiles(
  octokit: Octokit,
  org: string,
  repo: string,
  prNumber: number,
) {
  const { data } = await octokit.rest.pulls.listFiles({
    owner: org,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return data.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
  }));
}
