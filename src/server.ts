import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Octokit } from "@octokit/rest";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { registerRepositoryTools } from "./tools/repositoryTools.js";
import { registerWorkTrackingTools } from "./tools/workTrackingTools.js";

const octokit = new Octokit({ auth: config.githubToken });

export const server = new McpServer({ name: "github-workflow-mcp", version: "0.1.0" });

registerRepositoryTools(server, octokit, config.githubOrg);
registerWorkTrackingTools(server, octokit, config.githubOrg, config.allowedRepos);

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
