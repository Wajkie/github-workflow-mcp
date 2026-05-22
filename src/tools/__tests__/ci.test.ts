import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { getWorkflowRun, getWorkflowRunJobs, getFailedJobLogs, rerunFailedJobs } from "../ci.js";

function mockOctokit(): Octokit {
  return {
    rest: {
      actions: {
        getWorkflowRun: vi.fn(),
        listJobsForWorkflowRun: vi.fn(),
        downloadJobLogsForWorkflowRun: vi.fn(),
        reRunWorkflowFailedJobs: vi.fn(),
      },
    },
  } as unknown as Octokit;
}

const baseRun = {
  id: 42,
  name: "CI",
  status: "completed",
  conclusion: "failure",
  event: "push",
  head_branch: "main",
  head_sha: "abc123",
  triggering_actor: { login: "devuser" },
  created_at: "2026-05-22T10:00:00Z",
  updated_at: "2026-05-22T10:05:00Z",
  html_url: "https://github.com/org/repo/actions/runs/42",
};

describe("getWorkflowRun", () => {
  it("returns structured run detail", async () => {
    const octokit = mockOctokit();
    (octokit.rest.actions.getWorkflowRun as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: baseRun,
    });

    const result = await getWorkflowRun(octokit, "org", "repo", 42);

    expect(result).toEqual({
      id: 42,
      name: "CI",
      status: "completed",
      conclusion: "failure",
      event: "push",
      branch: "main",
      sha: "abc123",
      triggered_by: "devuser",
      created_at: "2026-05-22T10:00:00Z",
      updated_at: "2026-05-22T10:05:00Z",
      url: "https://github.com/org/repo/actions/runs/42",
    });
  });

  it("returns null for missing optional fields", async () => {
    const octokit = mockOctokit();
    (octokit.rest.actions.getWorkflowRun as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseRun, name: null, conclusion: null, head_branch: null, triggering_actor: null },
    });

    const result = await getWorkflowRun(octokit, "org", "repo", 42);

    expect(result.name).toBeNull();
    expect(result.conclusion).toBeNull();
    expect(result.branch).toBeNull();
    expect(result.triggered_by).toBeNull();
  });
});

describe("getWorkflowRunJobs", () => {
  it("returns jobs with step-level detail", async () => {
    const octokit = mockOctokit();
    (octokit.rest.actions.listJobsForWorkflowRun as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        jobs: [
          {
            id: 101,
            name: "build",
            status: "completed",
            conclusion: "failure",
            started_at: "2026-05-22T10:01:00Z",
            completed_at: "2026-05-22T10:03:00Z",
            steps: [
              { name: "Checkout", status: "completed", conclusion: "success", number: 1 },
              { name: "Run tests", status: "completed", conclusion: "failure", number: 2 },
            ],
          },
        ],
      },
    });

    const result = await getWorkflowRunJobs(octokit, "org", "repo", 42);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 101,
      name: "build",
      status: "completed",
      conclusion: "failure",
      steps: [
        { name: "Checkout", status: "completed", conclusion: "success", number: 1 },
        { name: "Run tests", status: "completed", conclusion: "failure", number: 2 },
      ],
    });
  });

  it("handles jobs with no steps", async () => {
    const octokit = mockOctokit();
    (octokit.rest.actions.listJobsForWorkflowRun as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        jobs: [
          {
            id: 102,
            name: "deploy",
            status: "completed",
            conclusion: "success",
            started_at: null,
            completed_at: null,
            steps: undefined,
          },
        ],
      },
    });

    const result = await getWorkflowRunJobs(octokit, "org", "repo", 42);
    expect(result[0].steps).toEqual([]);
  });
});

describe("getFailedJobLogs", () => {
  it("returns log text", async () => {
    const octokit = mockOctokit();
    (octokit.rest.actions.downloadJobLogsForWorkflowRun as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: "Error: test failed\n  at suite.js:42",
    });

    const result = await getFailedJobLogs(octokit, "org", "repo", 101);
    expect(result).toContain("Error: test failed");
  });

  it("truncates logs exceeding 50 KB and returns the tail", async () => {
    const octokit = mockOctokit();
    const longLog = "x".repeat(60_000) + "TAIL";
    (octokit.rest.actions.downloadJobLogsForWorkflowRun as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: longLog,
    });

    const result = await getFailedJobLogs(octokit, "org", "repo", 101);
    expect(result.length).toBeLessThanOrEqual(50_000);
    expect(result).toContain("TAIL");
  });
});

describe("rerunFailedJobs", () => {
  it("calls the rerun endpoint and returns queued status", async () => {
    const octokit = mockOctokit();
    const rerunFn = octokit.rest.actions.reRunWorkflowFailedJobs as unknown as ReturnType<typeof vi.fn>;
    rerunFn.mockResolvedValue({});

    const result = await rerunFailedJobs(octokit, "org", "repo", 42);

    expect(rerunFn).toHaveBeenCalledWith({ owner: "org", repo: "repo", run_id: 42 });
    expect(result).toEqual({ queued: true, run_id: 42 });
  });
});
