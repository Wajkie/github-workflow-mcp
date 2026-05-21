import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Octokit } from "@octokit/rest";
import {
  getFile,
  getRepository,
  listRepositories,
  searchCode,
} from "./repositories.js";

const TOOL_DEFS = [
  {
    name: "list_repositories",
    description: "List repositories in the organisation",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_repository",
    description: "Get metadata for a single repository",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository name (without owner prefix)" },
      },
      required: ["repo"],
    },
  },
  {
    name: "get_file",
    description: "Read a file from a repository. Recursive/wildcard paths are rejected.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "File path within the repository" },
        ref: {
          type: "string",
          description: "Git ref (branch, tag, or SHA). Defaults to the default branch.",
        },
      },
      required: ["repo", "path"],
    },
  },
  {
    name: "search_code",
    description:
      "Search for code within a repository. Returns file path, line number, and matched snippet.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo: { type: "string", description: "Repository name" },
        query: { type: "string", description: "Search query" },
      },
      required: ["repo", "query"],
    },
  },
];

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function registerRepositoryTools(
  server: Server,
  octokit: Octokit,
  org: string,
) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case "list_repositories": {
          const repos = await listRepositories(octokit, org);
          return ok({ repos });
        }
        case "get_repository": {
          const repo = String((args as { repo: string }).repo);
          const data = await getRepository(octokit, org, repo);
          return ok(data);
        }
        case "get_file": {
          const { repo, path, ref } = args as {
            repo: string;
            path: string;
            ref?: string;
          };
          const data = await getFile(octokit, org, String(repo), String(path), ref);
          return ok(data);
        }
        case "search_code": {
          const { repo, query } = args as { repo: string; query: string };
          const items = await searchCode(octokit, org, String(repo), String(query));
          return ok({ items });
        }
        default:
          return err(`Unknown tool: ${name}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(message);
    }
  });
}
