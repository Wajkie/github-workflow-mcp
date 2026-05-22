import type { Octokit } from "@octokit/rest";

export async function createBranch(
  octokit: Octokit,
  org: string,
  repo: string,
  branchName: string,
  base: string,
) {
  const { data: ref } = await octokit.rest.git.getRef({
    owner: org,
    repo,
    ref: `heads/${base}`,
  });

  const { data } = await octokit.rest.git.createRef({
    owner: org,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha,
  });

  return { ref: data.ref, sha: data.object.sha };
}

export async function createPullRequest(
  octokit: Octokit,
  org: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
) {
  const { data } = await octokit.rest.pulls.create({
    owner: org,
    repo,
    title,
    body,
    head,
    base,
  });

  return {
    number: data.number,
    url: data.html_url,
    state: data.state,
    draft: data.draft,
  };
}

export async function requestReview(
  octokit: Octokit,
  org: string,
  repo: string,
  prNumber: number,
  reviewers: string[],
) {
  const { data } = await octokit.rest.pulls.requestReviewers({
    owner: org,
    repo,
    pull_number: prNumber,
    reviewers,
  });

  return {
    number: data.number,
    requested_reviewers: data.requested_reviewers?.map((r) => r.login) ?? [],
  };
}

type MergeMethod = "squash" | "merge" | "rebase";

export async function writeFileToRepo(
  octokit: Octokit,
  org: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
): Promise<void> {
  let sha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({ owner: org, repo, path, ref: branch });
    if (!Array.isArray(data) && "sha" in data) sha = (data as { sha: string }).sha;
  } catch { /* file does not yet exist on this branch */ }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: org,
    repo,
    path,
    message,
    content: Buffer.from(content).toString("base64"),
    branch,
    sha,
  });
}

export async function mergePr(
  octokit: Octokit,
  org: string,
  repo: string,
  prNumber: number,
  method: MergeMethod = "squash",
) {
  const { data } = await octokit.rest.pulls.merge({
    owner: org,
    repo,
    pull_number: prNumber,
    merge_method: method,
  });

  return { merged: data.merged, sha: data.sha, message: data.message };
}
