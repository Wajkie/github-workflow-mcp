import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getFile, getRepository, listRepositories, searchCode } from "./repositories.js";
import { denied, isRepoAllowed } from "./allowlist.js";
import { ok, toErrorContent } from "./response.js";
import type { CacheClient } from "../cache.js";
import { withCache } from "../cache.js";

export function registerRepositoryTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos: string,
  cache: CacheClient,
  ttl: { repos: number; files: number },
) {
  server.registerTool(
    "list_repositories",
    {
      description: "List repositories in the organisation",
      inputSchema: {},
    },
    async () => {
      try {
        const repos = await withCache(cache, `list_repositories:${org}`, ttl.repos, () =>
          listRepositories(octokit, org),
        );
        return ok({ repos });
      } catch (err) {
        return toErrorContent(err);
      }
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
      try {
        const data = await withCache(cache, `get_repository:${org}:${repo}`, ttl.repos, () =>
          getRepository(octokit, org, repo),
        );
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
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
      try {
        const cacheKey = `get_file:${org}:${repo}:${path}:${ref ?? "default"}`;
        const data = await withCache(cache, cacheKey, ttl.files, () =>
          getFile(octokit, org, repo, path, ref),
        );
        return ok(data);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "search_code",
    {
      description:
        "Search for code within a repository. Returns file path, line number, and matched snippet.",
      inputSchema: {
        repo: z.string().describe("Repository name"),
        query: z
          .string()
          .describe("Search query")
          .refine((q) => !/(?:^|\s)\w+:(?!\/)/.test(q), {
            message: "Query must not contain GitHub search qualifier syntax (e.g. repo:, org:)",
          }),
      },
    },
    async ({ repo, query }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const items = await withCache(cache, `search_code:${org}:${repo}:${query}`, ttl.repos, () =>
          searchCode(octokit, org, repo, query),
        );
        return ok({ items });
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );
}
