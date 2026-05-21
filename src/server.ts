import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Octokit } from "@octokit/rest";
import { config } from "./config.js";
import { logger } from "./logger.js";
import {
  REPOSITORY_TOOL_DEFS,
  handleRepositoryTool,
} from "./tools/repositoryTools.js";
import {
  WORK_TRACKING_TOOL_DEFS,
  handleWorkTrackingTool,
} from "./tools/workTrackingTools.js";

const octokit = new Octokit({ auth: config.githubToken });

export const server = new Server(
  { name: "github-workflow-mcp", version: "0.1.0" },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

const ALL_TOOL_DEFS = [...REPOSITORY_TOOL_DEFS, ...WORK_TRACKING_TOOL_DEFS];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOL_DEFS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;

  try {
    const result =
      (await handleRepositoryTool(name, a, octokit, config.githubOrg)) ??
      (await handleWorkTrackingTool(name, a, octokit, config.githubOrg, config.allowedRepos));

    if (result === null) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text" as const, text: message }],
      isError: true,
    };
  }
});

// Health check — will be wired to the HTTP transport endpoint in Phase 2
export function getHealthStatus() {
  return {
    status: "ok",
    version: "0.1.0",
    org: config.githubOrg,
    allowWrites: config.allowWrites,
  };
}

async function main() {
  logger.info({
    msg: "Starting MCP server",
    transport: "stdio",
    org: config.githubOrg,
    allowedRepos: config.allowedRepos,
    allowWrites: config.allowWrites,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info({ msg: "MCP server connected", transport: "stdio" });
}

main().catch((err: Error) => {
  logger.error({ msg: "Server failed to start", error: err.message });
  process.exit(1);
});
