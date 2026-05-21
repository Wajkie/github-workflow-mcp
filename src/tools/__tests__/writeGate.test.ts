import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
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
