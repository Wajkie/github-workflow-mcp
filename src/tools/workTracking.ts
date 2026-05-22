import type { Octokit } from "@octokit/rest";

export async function getActiveWork(
  octokit: Octokit,
  org: string,
  allowedRepos: string,
) {
  const { data } = await octokit.rest.issues.listForOrg({
    org,
    state: "open",
    filter: "assigned",
    per_page: 50,
  });

  const allowed =
    allowedRepos === "*" ? null : new Set(allowedRepos.split(",").map((r) => r.trim()));

  const items = allowed
    ? data.filter((item) => allowed.has(item.repository_url.split("/").pop() ?? ""))
    : data;

  const toEntry = (item: typeof items[number]) => ({
    repo: item.repository_url.split("/").pop(),
    number: item.number,
    title: item.title,
    url: item.html_url,
  });

  return {
    pull_requests: items.filter((i) => !!i.pull_request).map(toEntry),
    issues: items.filter((i) => !i.pull_request).map(toEntry),
  };
}

export async function getIssue(
  octokit: Octokit,
  org: string,
  repo: string,
  issueNumber: number,
) {
  const { data } = await octokit.rest.issues.get({
    owner: org,
    repo,
    issue_number: issueNumber,
  });

  return {
    number: data.number,
    title: data.title,
    body: data.body ?? null,
    state: data.state,
    labels: data.labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))),
    assignees: (data.assignees ?? []).map((a) => a.login),
    url: data.html_url,
  };
}

export async function searchIssues(
  octokit: Octokit,
  org: string,
  repo: string,
  query: string,
  page = 1,
) {
  const { data } = await octokit.request("GET /search/issues", {
    q: `${query} repo:${org}/${repo} is:issue`,
    per_page: 20,
    page,
  });

  return {
    total_count: data.total_count,
    page,
    items: data.items.map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))),
      url: issue.html_url,
    })),
  };
}
