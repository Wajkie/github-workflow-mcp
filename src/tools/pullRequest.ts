import type { Octokit } from "@octokit/rest";
import { sanitizeContent } from "../sanitize.js";

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
