import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { getActiveWork, getIssue, searchIssues } from "../workTracking.js";
import { wrapUntrustedContent } from "../../sanitize.js";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    title: "Fix bug",
    state: "open",
    labels: [],
    html_url: "https://github.com/org/repo/issues/1",
    repository_url: "https://api.github.com/repos/org/my-repo",
    ...overrides,
  };
}

function mockOctokit(overrides: Record<string, unknown> = {}): Octokit {
  return {
    rest: {
      issues: { get: vi.fn(), listForOrg: vi.fn() },
      ...overrides,
    },
    request: vi.fn(),
  } as unknown as Octokit;
}

describe("getActiveWork", () => {
  it("returns prs and issues assigned to the authenticated user", async () => {
    const octokit = mockOctokit();
    const listFn = octokit.rest.issues.listForOrg as unknown as ReturnType<typeof vi.fn>;
    listFn.mockResolvedValue({
      data: [
        makeItem({ number: 10, title: "PR title", pull_request: { url: "https://github.com/org/repo/pull/10" } }),
        makeItem({ number: 20, title: "Issue title" }),
      ],
    });

    const result = await getActiveWork(octokit, "my-org", "*");

    expect(result.pull_requests).toHaveLength(1);
    expect(result.pull_requests[0]).toMatchObject({ number: 10, title: "PR title", repo: "my-repo" });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ number: 20, title: "Issue title" });
  });

  it("filters results by ALLOWED_REPOS when not wildcard", async () => {
    const octokit = mockOctokit();
    const listFn = octokit.rest.issues.listForOrg as unknown as ReturnType<typeof vi.fn>;
    listFn.mockResolvedValue({
      data: [
        makeItem({ number: 1, repository_url: "https://api.github.com/repos/org/allowed-repo", pull_request: { url: "" } }),
        makeItem({ number: 2, repository_url: "https://api.github.com/repos/org/other-repo", pull_request: { url: "" } }),
      ],
    });

    const result = await getActiveWork(octokit, "my-org", "allowed-repo");

    expect(result.pull_requests).toHaveLength(1);
    expect(result.pull_requests[0].repo).toBe("allowed-repo");
  });

  it("calls listForOrg with the given org", async () => {
    const octokit = mockOctokit();
    const listFn = octokit.rest.issues.listForOrg as unknown as ReturnType<typeof vi.fn>;
    listFn.mockResolvedValue({ data: [] });

    await getActiveWork(octokit, "my-org", "*");

    expect(listFn).toHaveBeenCalledWith(expect.objectContaining({ org: "my-org", filter: "assigned" }));
  });
});

describe("getIssue", () => {
  it("returns trimmed issue fields", async () => {
    const octokit = mockOctokit();
    (octokit.rest.issues.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        number: 42,
        title: "Bug report",
        body: "Something broke",
        state: "open",
        labels: [{ name: "bug" }, { name: "priority" }],
        assignees: [{ login: "alice" }],
        html_url: "https://github.com/org/repo/issues/42",
        comments: 5,
      },
    });

    const result = await getIssue(octokit, "my-org", "my-repo", 42);

    expect(result).toEqual({
      number: 42,
      title: "Bug report",
      body: wrapUntrustedContent("Something broke"),
      state: "open",
      labels: ["bug", "priority"],
      assignees: ["alice"],
      url: "https://github.com/org/repo/issues/42",
    });
    expect(result).not.toHaveProperty("comments");
  });

  it("sets body to null when absent", async () => {
    const octokit = mockOctokit();
    (octokit.rest.issues.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        number: 1,
        title: "No body",
        body: null,
        state: "open",
        labels: [],
        assignees: [],
        html_url: "https://github.com/org/repo/issues/1",
      },
    });

    const result = await getIssue(octokit, "org", "repo", 1);
    expect(result.body).toBeNull();
  });

  it("passes issue_number to the API", async () => {
    const octokit = mockOctokit();
    const fn = octokit.rest.issues.get as unknown as ReturnType<typeof vi.fn>;
    fn.mockResolvedValue({
      data: {
        number: 7,
        title: "T",
        body: null,
        state: "open",
        labels: [],
        assignees: [],
        html_url: "",
      },
    });

    await getIssue(octokit, "org", "repo", 7);

    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 7, owner: "org", repo: "repo" }),
    );
  });
});

describe("searchIssues", () => {
  it("returns paginated results capped at 20", async () => {
    const octokit = mockOctokit();
    (octokit.request as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        total_count: 42,
        items: [makeItem({ number: 3, title: "Found issue", state: "open", labels: [] })],
      },
    });

    const result = await searchIssues(octokit, "org", "repo", "authentication", 2);

    expect(result.total_count).toBe(42);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ number: 3, title: "Found issue" });
  });

  it("scopes search to the given repo", async () => {
    const octokit = mockOctokit();
    const requestFn = octokit.request as unknown as ReturnType<typeof vi.fn>;
    requestFn.mockResolvedValue({ data: { total_count: 0, items: [] } });

    await searchIssues(octokit, "my-org", "my-repo", "login");

    expect(requestFn).toHaveBeenCalledWith(
      "GET /search/issues",
      expect.objectContaining({ q: expect.stringContaining("repo:my-org/my-repo") }),
    );
  });

  it("defaults to page 1", async () => {
    const octokit = mockOctokit();
    const requestFn = octokit.request as unknown as ReturnType<typeof vi.fn>;
    requestFn.mockResolvedValue({ data: { total_count: 0, items: [] } });

    const result = await searchIssues(octokit, "org", "repo", "query");
    expect(result.page).toBe(1);
    expect(requestFn).toHaveBeenCalledWith(
      "GET /search/issues",
      expect.objectContaining({ page: 1 }),
    );
  });
});
