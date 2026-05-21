import { describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import {
  getFile,
  getRepository,
  listRepositories,
  searchCode,
} from "../repositories.js";

function mockOctokit(overrides: Record<string, unknown> = {}): Octokit {
  return {
    rest: {
      repos: {
        listForOrg: vi.fn(),
        get: vi.fn(),
        getContent: vi.fn(),
      },
      search: {
        code: vi.fn(),
      },
      ...overrides,
    },
  } as unknown as Octokit;
}

describe("listRepositories", () => {
  it("returns trimmed repo data", async () => {
    const octokit = mockOctokit();
    (octokit.rest.repos.listForOrg as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          name: "my-repo",
          description: "A repo",
          default_branch: "main",
          visibility: "private",
          stargazers_count: 99,
          extra_field: "ignored",
        },
      ],
    });

    const result = await listRepositories(octokit, "my-org");

    expect(result).toEqual([
      { name: "my-repo", description: "A repo", default_branch: "main", visibility: "private" },
    ]);
    expect(result[0]).not.toHaveProperty("stargazers_count");
  });

  it("sets description to null when absent", async () => {
    const octokit = mockOctokit();
    (octokit.rest.repos.listForOrg as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ name: "bare", description: null, default_branch: "main", visibility: "public" }],
    });

    const [repo] = await listRepositories(octokit, "my-org");
    expect(repo.description).toBeNull();
  });
});

describe("getRepository", () => {
  it("returns expected fields", async () => {
    const octokit = mockOctokit();
    (octokit.rest.repos.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        name: "my-repo",
        description: "Desc",
        default_branch: "main",
        visibility: "private",
        language: "TypeScript",
        topics: ["mcp"],
        size: 512,
        open_issues_count: 3,
        homepage: "https://example.com",
      },
    });

    const result = await getRepository(octokit, "my-org", "my-repo");

    expect(result).toEqual({
      name: "my-repo",
      description: "Desc",
      default_branch: "main",
      visibility: "private",
      language: "TypeScript",
      topics: ["mcp"],
      size: 512,
      open_issues_count: 3,
    });
    expect(result).not.toHaveProperty("homepage");
  });
});

describe("getFile", () => {
  it("decodes base64 content", async () => {
    const octokit = mockOctokit();
    const raw = "hello world";
    const encoded = Buffer.from(raw).toString("base64");

    (octokit.rest.repos.getContent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { type: "file", path: "src/index.ts", sha: "abc123", size: 11, encoding: "base64", content: encoded },
    });

    const result = await getFile(octokit, "my-org", "my-repo", "src/index.ts");
    expect(result.content).toBe(raw);
    expect(result.sha).toBe("abc123");
  });

  it("rejects paths with wildcards", async () => {
    const octokit = mockOctokit();
    await expect(getFile(octokit, "org", "repo", "src/**/*.ts")).rejects.toThrow("Unsafe path");
  });

  it("rejects paths with ..", async () => {
    const octokit = mockOctokit();
    await expect(getFile(octokit, "org", "repo", "../secret")).rejects.toThrow("Unsafe path");
  });

  it("rejects absolute paths", async () => {
    const octokit = mockOctokit();
    await expect(getFile(octokit, "org", "repo", "/etc/passwd")).rejects.toThrow("Unsafe path");
  });

  it("rejects directory responses", async () => {
    const octokit = mockOctokit();
    (octokit.rest.repos.getContent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ type: "dir", name: "src" }],
    });
    await expect(getFile(octokit, "org", "repo", "src")).rejects.toThrow("directory");
  });

  it("passes ref when provided", async () => {
    const octokit = mockOctokit();
    const encoded = Buffer.from("content").toString("base64");
    (octokit.rest.repos.getContent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { type: "file", path: "file.ts", sha: "sha1", size: 7, encoding: "base64", content: encoded },
    });

    await getFile(octokit, "org", "repo", "file.ts", "feature-branch");

    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "feature-branch" }),
    );
  });
});

describe("searchCode", () => {
  it("returns path, url, and snippet", async () => {
    const octokit = mockOctokit();
    (octokit.rest.search.code as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        items: [
          {
            path: "src/auth.ts",
            html_url: "https://github.com/org/repo/blob/main/src/auth.ts",
            text_matches: [{ fragment: "const token = req.headers.authorization" }],
          },
        ],
      },
    });

    const result = await searchCode(octokit, "my-org", "my-repo", "token");

    expect(result).toEqual([
      {
        path: "src/auth.ts",
        url: "https://github.com/org/repo/blob/main/src/auth.ts",
        snippet: "const token = req.headers.authorization",
      },
    ]);
  });

  it("sets snippet to null when no text_matches", async () => {
    const octokit = mockOctokit();
    (octokit.rest.search.code as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        items: [{ path: "README.md", html_url: "https://github.com/org/repo/blob/main/README.md" }],
      },
    });

    const [item] = await searchCode(octokit, "org", "repo", "query");
    expect(item.snippet).toBeNull();
  });

  it("includes the repo scope in the query", async () => {
    const octokit = mockOctokit();
    (octokit.rest.search.code as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [] } });

    await searchCode(octokit, "my-org", "my-repo", "useState");

    expect(octokit.rest.search.code).toHaveBeenCalledWith(
      expect.objectContaining({ q: "useState repo:my-org/my-repo" }),
    );
  });
});
