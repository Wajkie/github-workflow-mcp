import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { createBranch, createPullRequest, mergePr, requestReview } from "../githubWrite.js";

function mockOctokit(overrides: Record<string, unknown> = {}): Octokit {
  return {
    rest: {
      git: {
        getRef: vi.fn(),
        createRef: vi.fn(),
      },
      pulls: {
        create: vi.fn(),
        requestReviewers: vi.fn(),
        merge: vi.fn(),
      },
      ...overrides,
    },
  } as unknown as Octokit;
}

describe("createBranch", () => {
  it("resolves the base SHA and creates the ref", async () => {
    const octokit = mockOctokit();
    const getRef = octokit.rest.git.getRef as unknown as ReturnType<typeof vi.fn>;
    const createRef = octokit.rest.git.createRef as unknown as ReturnType<typeof vi.fn>;
    getRef.mockResolvedValue({ data: { object: { sha: "abc123" } } });
    createRef.mockResolvedValue({ data: { ref: "refs/heads/my-branch", object: { sha: "abc123" } } });

    const result = await createBranch(octokit, "my-org", "my-repo", "my-branch", "main");

    expect(getRef).toHaveBeenCalledWith({ owner: "my-org", repo: "my-repo", ref: "heads/main" });
    expect(createRef).toHaveBeenCalledWith({
      owner: "my-org",
      repo: "my-repo",
      ref: "refs/heads/my-branch",
      sha: "abc123",
    });
    expect(result).toEqual({ ref: "refs/heads/my-branch", sha: "abc123" });
  });
});

describe("createPullRequest", () => {
  it("opens a PR and returns trimmed fields", async () => {
    const octokit = mockOctokit();
    const create = octokit.rest.pulls.create as unknown as ReturnType<typeof vi.fn>;
    create.mockResolvedValue({
      data: { number: 42, html_url: "https://github.com/org/repo/pull/42", state: "open", draft: false },
    });

    const result = await createPullRequest(octokit, "org", "repo", "My PR", "body", "feature", "main");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "org", repo: "repo", title: "My PR", head: "feature", base: "main" }),
    );
    expect(result).toEqual({ number: 42, url: "https://github.com/org/repo/pull/42", state: "open", draft: false });
  });
});

describe("requestReview", () => {
  it("requests reviewers and returns their logins", async () => {
    const octokit = mockOctokit();
    const requestReviewers = octokit.rest.pulls.requestReviewers as unknown as ReturnType<typeof vi.fn>;
    requestReviewers.mockResolvedValue({
      data: { number: 10, requested_reviewers: [{ login: "alice" }, { login: "bob" }] },
    });

    const result = await requestReview(octokit, "org", "repo", 10, ["alice", "bob"]);

    expect(requestReviewers).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "org", repo: "repo", pull_number: 10, reviewers: ["alice", "bob"] }),
    );
    expect(result).toEqual({ number: 10, requested_reviewers: ["alice", "bob"] });
  });

  it("returns empty array when requested_reviewers is absent", async () => {
    const octokit = mockOctokit();
    (octokit.rest.pulls.requestReviewers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { number: 10, requested_reviewers: null },
    });

    const result = await requestReview(octokit, "org", "repo", 10, ["alice"]);
    expect(result.requested_reviewers).toEqual([]);
  });
});

describe("mergePr", () => {
  it("merges with squash by default", async () => {
    const octokit = mockOctokit();
    const merge = octokit.rest.pulls.merge as unknown as ReturnType<typeof vi.fn>;
    merge.mockResolvedValue({ data: { merged: true, sha: "def456", message: "Squashed" } });

    const result = await mergePr(octokit, "org", "repo", 5);

    expect(merge).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 5, merge_method: "squash" }),
    );
    expect(result).toEqual({ merged: true, sha: "def456", message: "Squashed" });
  });

  it("uses the specified merge method", async () => {
    const octokit = mockOctokit();
    const merge = octokit.rest.pulls.merge as unknown as ReturnType<typeof vi.fn>;
    merge.mockResolvedValue({ data: { merged: true, sha: "ghi789", message: "Rebased" } });

    await mergePr(octokit, "org", "repo", 5, "rebase");

    expect(merge).toHaveBeenCalledWith(
      expect.objectContaining({ merge_method: "rebase" }),
    );
  });
});
