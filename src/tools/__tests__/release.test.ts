import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { getReleaseStatus, getRecentDeployments } from "../release.js";
import { wrapUntrustedContent } from "../../sanitize.js";

function mockOctokit(): Octokit {
  return {
    rest: {
      repos: { getLatestRelease: vi.fn() },
      actions: { listWorkflowRunsForRepo: vi.fn() },
    },
  } as unknown as Octokit;
}

describe("getReleaseStatus", () => {
  it("returns trimmed release fields", async () => {
    const octokit = mockOctokit();
    (octokit.rest.repos.getLatestRelease as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        tag_name: "v1.2.0",
        name: "Release 1.2.0",
        published_at: "2026-05-01T12:00:00Z",
        draft: false,
        prerelease: false,
        body: "Bug fixes and performance improvements.",
        html_url: "https://github.com/org/repo/releases/tag/v1.2.0",
      },
    });

    const result = await getReleaseStatus(octokit, "org", "repo");

    expect(result).toEqual({
      tag: "v1.2.0",
      name: "Release 1.2.0",
      published_at: "2026-05-01T12:00:00Z",
      draft: false,
      prerelease: false,
      body_summary: wrapUntrustedContent("Bug fixes and performance improvements."),
      url: "https://github.com/org/repo/releases/tag/v1.2.0",
    });
  });

  it("truncates body to 500 characters", async () => {
    const octokit = mockOctokit();
    const longBody = "x".repeat(600);
    (octokit.rest.repos.getLatestRelease as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        tag_name: "v1.0.0",
        name: null,
        published_at: null,
        draft: false,
        prerelease: false,
        body: longBody,
        html_url: "https://github.com/org/repo/releases/tag/v1.0.0",
      },
    });

    const result = await getReleaseStatus(octokit, "org", "repo");
    expect(result.body_summary).toEqual(wrapUntrustedContent("x".repeat(500)));
  });

  it("returns null body_summary when body is absent", async () => {
    const octokit = mockOctokit();
    (octokit.rest.repos.getLatestRelease as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        tag_name: "v0.1.0",
        name: null,
        published_at: null,
        draft: true,
        prerelease: false,
        body: null,
        html_url: "https://github.com/org/repo/releases/tag/v0.1.0",
      },
    });

    const result = await getReleaseStatus(octokit, "org", "repo");
    expect(result.body_summary).toBeNull();
  });
});

describe("getRecentDeployments", () => {
  it("returns up to 10 workflow runs with trimmed fields", async () => {
    const octokit = mockOctokit();
    const mockRun = {
      id: 1,
      name: "CI",
      status: "completed",
      conclusion: "success",
      event: "push",
      head_branch: "main",
      created_at: "2026-05-20T10:00:00Z",
      updated_at: "2026-05-20T10:05:00Z",
      html_url: "https://github.com/org/repo/actions/runs/1",
    };
    (octokit.rest.actions.listWorkflowRunsForRepo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { workflow_runs: [mockRun] },
    });

    const result = await getRecentDeployments(octokit, "org", "repo");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      name: "CI",
      status: "completed",
      conclusion: "success",
      event: "push",
      branch: "main",
      created_at: "2026-05-20T10:00:00Z",
      updated_at: "2026-05-20T10:05:00Z",
      url: "https://github.com/org/repo/actions/runs/1",
    });
  });

  it("requests at most 10 results from the API", async () => {
    const octokit = mockOctokit();
    const listFn = octokit.rest.actions.listWorkflowRunsForRepo as unknown as ReturnType<typeof vi.fn>;
    listFn.mockResolvedValue({ data: { workflow_runs: [] } });

    await getRecentDeployments(octokit, "org", "repo");

    expect(listFn).toHaveBeenCalledWith(
      expect.objectContaining({ per_page: 10 }),
    );
  });

  it("returns null for conclusion and branch when absent", async () => {
    const octokit = mockOctokit();
    (octokit.rest.actions.listWorkflowRunsForRepo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        workflow_runs: [{
          id: 2,
          name: null,
          status: "in_progress",
          conclusion: null,
          event: "workflow_dispatch",
          head_branch: null,
          created_at: "2026-05-21T08:00:00Z",
          updated_at: "2026-05-21T08:01:00Z",
          html_url: "https://github.com/org/repo/actions/runs/2",
        }],
      },
    });

    const [run] = await getRecentDeployments(octokit, "org", "repo");
    expect(run.conclusion).toBeNull();
    expect(run.branch).toBeNull();
    expect(run.name).toBeNull();
  });
});
