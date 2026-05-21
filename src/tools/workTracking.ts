import type { Octokit } from "@octokit/rest";

export async function getActiveWork(
  octokit: Octokit,
  org: string,
  allowedRepos: string,
) {
  const { data: user } = await octokit.rest.users.getAuthenticated();
  const login = user.login;

  const [prsResult, issuesResult] = await Promise.all([
    octokit.rest.search.issuesAndPullRequests({
      q: `is:open is:pr assignee:${login} org:${org}`,
      per_page: 50,
    }),
    octokit.rest.search.issuesAndPullRequests({
      q: `is:open is:issue assignee:${login} org:${org}`,
      per_page: 50,
    }),
  ]);

  const allowed =
    allowedRepos === "*" ? null : new Set(allowedRepos.split(",").map((r) => r.trim()));

  function filterByAllowed<T extends { repository_url: string }>(items: T[]): T[] {
    if (!allowed) return items;
    return items.filter((item) => {
      const repo = item.repository_url.split("/").pop() ?? "";
      return allowed.has(repo);
    });
  }

  return {
    pull_requests: filterByAllowed(prsResult.data.items).map((pr) => ({
      repo: pr.repository_url.split("/").pop(),
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
    })),
    issues: filterByAllowed(issuesResult.data.items).map((issue) => ({
      repo: issue.repository_url.split("/").pop(),
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
    })),
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
  const { data } = await octokit.rest.search.issuesAndPullRequests({
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
