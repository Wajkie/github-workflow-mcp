import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getFile, getRepository, listRepositories, searchCode } from "./repositories.js";
import { denied, isRepoAllowed } from "./allowlist.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerRepositoryTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
) {
  server.registerTool(
    "list_repositories",
    {
      description: "List repositories in the organisation",
      inputSchema: {},
    },
    async () => {
      const repos = await listRepositories(octokit, org);
      return ok({ repos });
    },
  );

  server.registerTool(
    "get_repository",
    {
      description: "Get metadata for a single repository",
      inputSchema: { repo: z.string().describe("Repository name (without owner prefix)") },
    },
    async ({ repo }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      const data = await getRepository(octokit, org, repo);
      return ok(data);
    },
  );

  server.registerTool(
    "get_file",
    {
      description: "Read a file from a repository. Recursive/wildcard paths are rejected.",
      inputSchema: {
        repo: z.string().describe("Repository name"),
        path: z.string().describe("File path within the repository"),
        ref: z
          .string()
          .optional()
          .describe("Git ref (branch, tag, or SHA). Defaults to the default branch."),
      },
    },
    async ({ repo, path, ref }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      const data = await getFile(octokit, org, repo, path, ref);
      return ok(data);
    },
  );

  server.registerTool(
    "search_code",
    {
      description:
        "Search for code within a repository. Returns file path, line number, and matched snippet.",
      inputSchema: {
        repo: z.string().describe("Repository name"),
        query: z.string().describe("Search query"),
      },
    },
    async ({ repo, query }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      const items = await searchCode(octokit, org, repo, query);
      return ok({ items });
    },
  );
}
