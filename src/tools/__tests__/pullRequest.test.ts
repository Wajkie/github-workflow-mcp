import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { getChangedFiles, getPr } from "../pullRequest.js";

function makePrData(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    title: "Add feature",
    body: "Description",
    state: "open",
    draft: false,
    head: { ref: "feature-branch" },
    base: { ref: "main" },
    user: { login: "alice" },
    requested_reviewers: [{ login: "bob" }],
    labels: [{ name: "enhancement" }],
    merged: false,
    mergeable: true,
    html_url: "https://github.com/org/repo/pull/1",
    ...overrides,
  };
}

function mockOctokit(overrides: Record<string, unknown> = {}): Octokit {
  return {
    rest: {
      pulls: {
        get: vi.fn(),
        listFiles: vi.fn(),
        ...overrides,
      },
    },
  } as unknown as Octokit;
}

describe("getPr", () => {
  it("returns trimmed PR fields", async () => {
    const octokit = mockOctokit();
    (octokit.rest.pulls.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: makePrData(),
    });

    const result = await getPr(octokit, "my-org", "my-repo", 1);

    expect(result).toEqual({
      number: 1,
      title: "Add feature",
      body: "Description",
      state: "open",
      draft: false,
      head: "feature-branch",
      base: "main",
      author: "alice",
      reviewers: ["bob"],
      labels: ["enhancement"],
      merged: false,
      mergeable: true,
      url: "https://github.com/org/repo/pull/1",
    });
  });

  it("sets body to null when absent", async () => {
    const octokit = mockOctokit();
    (octokit.rest.pulls.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: makePrData({ body: null }),
    });

    const result = await getPr(octokit, "org", "repo", 1);
    expect(result.body).toBeNull();
  });

  it("sets author to null when user is absent", async () => {
    const octokit = mockOctokit();
    (octokit.rest.pulls.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: makePrData({ user: null }),
    });

    const result = await getPr(octokit, "org", "repo", 1);
    expect(result.author).toBeNull();
  });

  it("passes pull_number, owner, repo to the API", async () => {
    const octokit = mockOctokit();
    const fn = octokit.rest.pulls.get as unknown as ReturnType<typeof vi.fn>;
    fn.mockResolvedValue({ data: makePrData() });

    await getPr(octokit, "my-org", "my-repo", 42);

    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 42, owner: "my-org", repo: "my-repo" }),
    );
  });

  it("does not include commit history or full file contents", async () => {
    const octokit = mockOctokit();
    (octokit.rest.pulls.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: makePrData(),
    });

    const result = await getPr(octokit, "org", "repo", 1);

    expect(result).not.toHaveProperty("commits");
    expect(result).not.toHaveProperty("files");
    expect(result).not.toHaveProperty("diff");
  });
});

describe("getChangedFiles", () => {
  it("returns filename, status, additions, deletions, and patch", async () => {
    const octokit = mockOctokit();
    (octokit.rest.pulls.listFiles as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          filename: "src/index.ts",
          status: "modified",
          additions: 10,
          deletions: 3,
          patch: "@@ -1,3 +1,10 @@\n...",
        },
        {
          filename: "src/new.ts",
          status: "added",
          additions: 50,
          deletions: 0,
          patch: "@@ -0,0 +1,50 @@\n...",
        },
      ],
    });

    const result = await getChangedFiles(octokit, "my-org", "my-repo", 5);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      filename: "src/index.ts",
      status: "modified",
      additions: 10,
      deletions: 3,
      patch: "@@ -1,3 +1,10 @@\n...",
    });
    expect(result[1].status).toBe("added");
  });

  it("sets patch to null when absent", async () => {
    const octokit = mockOctokit();
    (octokit.rest.pulls.listFiles as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          filename: "large-binary.bin",
          status: "modified",
          additions: 0,
          deletions: 0,
        },
      ],
    });

    const result = await getChangedFiles(octokit, "org", "repo", 1);
    expect(result[0].patch).toBeNull();
  });

  it("passes pull_number, owner, repo to the API", async () => {
    const octokit = mockOctokit();
    const fn = octokit.rest.pulls.listFiles as unknown as ReturnType<typeof vi.fn>;
    fn.mockResolvedValue({ data: [] });

    await getChangedFiles(octokit, "my-org", "my-repo", 7);

    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 7, owner: "my-org", repo: "my-repo" }),
    );
  });
});
