import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import type { AuditLogger } from "../../audit.js";
import { registerGithubWriteTools } from "../githubWriteTools.js";

function makeServer() {
  const handlers = new Map<string, (args: unknown) => Promise<unknown>>();
  return {
    server: {
      registerTool: vi.fn((name: string, _schema: unknown, handler: (args: unknown) => Promise<unknown>) => {
        handlers.set(name, handler);
      }),
    } as unknown as McpServer,
    call: (name: string, args: unknown) => {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`Tool not registered: ${name}`);
      return handler(args);
    },
  };
}

function mockOctokit(): Octokit {
  return {} as unknown as Octokit;
}

describe("write gate", () => {
  const tools = ["create_branch", "create_pull_request", "request_review", "merge_pr"];

  it.each(tools)("%s returns a descriptive error when allowWrites is false", async (toolName) => {
    const { server, call } = makeServer();
    registerGithubWriteTools(server, mockOctokit(), "org", "*", false);

    const result = await call(toolName, { repo: "any", branch_name: "b", base: "main", title: "t", body: "b", head: "h", pr_number: 1, reviewers: [] }) as { isError: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toContain("ALLOW_WRITES=true");
  });
});

describe("audit logging", () => {
  function mockOctokitWithWrite(): Octokit {
    return {
      rest: {
        git: {
          getRef: vi.fn().mockResolvedValue({ data: { object: { sha: "abc" } } }),
          createRef: vi.fn().mockResolvedValue({ data: { ref: "refs/heads/b", object: { sha: "abc" } } }),
        },
        pulls: {
          create: vi.fn().mockResolvedValue({ data: { number: 1, html_url: "https://github.com/org/repo/pull/1", state: "open", draft: false } }),
          requestReviewers: vi.fn().mockResolvedValue({ data: { number: 1, requested_reviewers: [] } }),
          merge: vi.fn().mockResolvedValue({ data: { merged: true, sha: "abc", message: "ok" } }),
        },
      },
    } as unknown as Octokit;
  }

  it("calls auditLog with success after create_branch succeeds", async () => {
    const auditLog: AuditLogger = vi.fn().mockResolvedValue(undefined);
    const { server, call } = makeServer();
    registerGithubWriteTools(server, mockOctokitWithWrite(), "org", "*", true, auditLog, "bot");

    await call("create_branch", { repo: "r", branch_name: "b", base: "main" });

    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ tool: "create_branch", outcome: "success", actor: "bot" }));
  });

  it("calls auditLog with error and rethrows when create_branch fails", async () => {
    const auditLog: AuditLogger = vi.fn().mockResolvedValue(undefined);
    const octokit = mockOctokitWithWrite();
    (octokit.rest.git.getRef as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API error"));
    const { server, call } = makeServer();
    registerGithubWriteTools(server, octokit, "org", "*", true, auditLog, "bot");

    await expect(call("create_branch", { repo: "r", branch_name: "b", base: "main" })).rejects.toThrow("API error");
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ tool: "create_branch", outcome: "error", error: expect.stringContaining("API error"), actor: "bot" }));
  });
});
