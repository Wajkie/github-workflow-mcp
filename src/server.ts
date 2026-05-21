import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Octokit } from "@octokit/rest";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { createAuditLogger, AuditLogger } from "./audit.js";
import { startHttpServer } from "./http.js";
import { registerRepositoryTools } from "./tools/repositoryTools.js";
import { registerPullRequestTools } from "./tools/pullRequestTools.js";
import { registerWorkTrackingTools } from "./tools/workTrackingTools.js";
import { registerLintingTools } from "./tools/lintingTools.js";
import { registerGithubWriteTools } from "./tools/githubWriteTools.js";
import { registerReleaseTools } from "./tools/releaseTools.js";
import { registerKnowledgeResources } from "./resources/knowledgeResources.js";

const octokit = new Octokit({ auth: config.githubToken });

export const server = new McpServer({ name: "github-workflow-mcp", version: "0.1.0" });

export function getHealthStatus() {
  return {
    status: "ok",
    version: "0.1.0",
    org: config.githubOrg,
    allowWrites: config.allowWrites,
  };
}

function buildMcpServer(auditLog: AuditLogger, actor: string): McpServer {
  const s = new McpServer({ name: "github-workflow-mcp", version: "0.1.0" });
  registerRepositoryTools(s, octokit, config.githubOrg, config.allowedRepos);
  registerWorkTrackingTools(s, octokit, config.githubOrg, config.allowedRepos);
  registerPullRequestTools(s, octokit, config.githubOrg, config.allowedRepos);
  registerLintingTools(s, octokit, config.githubOrg);
  registerGithubWriteTools(s, octokit, config.githubOrg, config.allowedRepos, config.allowWrites, auditLog, actor);
  registerReleaseTools(s, octokit, config.githubOrg, config.allowedRepos);
  registerKnowledgeResources(s);
  return s;
}

async function main() {
  const auditLog = await createAuditLogger(config.databaseUrl);

  let actor = "unknown";
  if (config.databaseUrl) {
    try {
      const { data } = await octokit.users.getAuthenticated();
      actor = data.login;
    } catch { /* keep "unknown" if token cannot be resolved */ }
  }

  registerRepositoryTools(server, octokit, config.githubOrg, config.allowedRepos);
  registerWorkTrackingTools(server, octokit, config.githubOrg, config.allowedRepos);
  registerPullRequestTools(server, octokit, config.githubOrg, config.allowedRepos);
  registerLintingTools(server, octokit, config.githubOrg);
  registerGithubWriteTools(server, octokit, config.githubOrg, config.allowedRepos, config.allowWrites, auditLog, actor);
  registerReleaseTools(server, octokit, config.githubOrg, config.allowedRepos);
  registerKnowledgeResources(server);

  const transports = config.port !== undefined ? ["stdio", "http"] : ["stdio"];
  logger.info({
    msg: "Starting MCP server",
    transports,
    org: config.githubOrg,
    allowedRepos: config.allowedRepos,
    allowWrites: config.allowWrites,
    auditEnabled: !!config.databaseUrl,
  });

  if (config.port !== undefined) {
    await startHttpServer(config.port, () => buildMcpServer(auditLog, actor), getHealthStatus);
  }

  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);

  logger.info({ msg: "MCP server connected", transport: "stdio" });
}

main().catch((err: Error) => {
  logger.error({ msg: "Server failed to start", error: err.message });
  process.exit(1);
});
