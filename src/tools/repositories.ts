import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Octokit } from "@octokit/rest";

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
        ref: { type: "string", description: "Git ref (branch, tag, or SHA). Defaults to the default branch." },
      },
      required: ["repo", "path"],
    },
  },
  {
    name: "search_code",
    description: "Search for code within a repository. Returns file path, line number, and matched snippet.",
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

export async function listRepositories(octokit: Octokit, org: string) {
  const { data } = await octokit.rest.repos.listForOrg({
    org,
    type: "all",
    per_page: 100,
  });
  return data.map((r) => ({
    name: r.name,
    description: r.description ?? null,
    default_branch: r.default_branch,
    visibility: r.visibility ?? "private",
  }));
}

export async function getRepository(octokit: Octokit, org: string, repo: string) {
  const { data: r } = await octokit.rest.repos.get({ owner: org, repo });
  return {
    name: r.name,
    description: r.description ?? null,
    default_branch: r.default_branch,
    visibility: r.visibility ?? "private",
    language: r.language ?? null,
    topics: r.topics ?? [],
    size: r.size,
    open_issues_count: r.open_issues_count,
  };
}

const UNSAFE_PATH = /(\*|\.\.|\/\/|^\/)/;

export async function getFile(
  octokit: Octokit,
  org: string,
  repo: string,
  path: string,
  ref?: string,
) {
  if (UNSAFE_PATH.test(path)) {
    throw new Error(`Unsafe path rejected: ${path}`);
  }

  const params: { owner: string; repo: string; path: string; ref?: string } = {
    owner: org,
    repo,
    path,
  };
  if (ref) params.ref = ref;

  const { data } = await octokit.rest.repos.getContent(params);

  if (Array.isArray(data)) {
    throw new Error(`Path is a directory, not a file: ${path}`);
  }
  if (data.type !== "file") {
    throw new Error(`Expected file, got ${data.type}: ${path}`);
  }

  const content =
    data.encoding === "base64"
      ? Buffer.from(data.content, "base64").toString("utf-8")
      : data.content;

  return { path: data.path, sha: data.sha, size: data.size, content };
}

export async function searchCode(
  octokit: Octokit,
  org: string,
  repo: string,
  query: string,
) {
  const { data } = await (octokit as OctokitWithTextMatch).rest.search.code({
    q: `${query} repo:${org}/${repo}`,
    per_page: 30,
    headers: { accept: "application/vnd.github.text-match+json" },
  });

  return data.items.map((item) => {
    const match = item.text_matches?.[0];
    return {
      path: item.path,
      url: item.html_url,
      snippet: match?.fragment ?? null,
    };
  });
}

// Octokit's type for search.code doesn't expose text_matches or custom headers — cast to allow them.
type OctokitWithTextMatch = Omit<Octokit, "rest"> & {
  rest: Omit<Octokit["rest"], "search"> & {
    search: {
      code: (params: {
        q: string;
        per_page?: number;
        headers?: Record<string, string>;
      }) => Promise<{
        data: {
          items: Array<{
            path: string;
            html_url: string;
            text_matches?: Array<{ fragment: string }>;
          }>;
        };
      }>;
    };
  };
};

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
