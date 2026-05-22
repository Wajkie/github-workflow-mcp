import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Octokit } from "@octokit/rest";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { createAuditLogger, AuditLogger } from "./audit.js";
import { createCache, CacheClient } from "./cache.js";
import { startHttpServer } from "./http.js";
import { registerRepositoryTools } from "./tools/repositoryTools.js";
import { registerPullRequestTools } from "./tools/pullRequestTools.js";
import { registerWorkTrackingTools } from "./tools/workTrackingTools.js";
import { registerLintingTools } from "./tools/lintingTools.js";
import { detectLinters } from "./tools/linting.js";
import { registerGithubWriteTools } from "./tools/githubWriteTools.js";
import { registerReleaseTools } from "./tools/releaseTools.js";
import { registerCiTools } from "./tools/ciTools.js";
import { registerKnowledgeResources } from "./resources/knowledgeResources.js";
import { registerKnowledgeTools } from "./tools/knowledgeTools.js";
import { createKnowledgeSearcher } from "./knowledge/search.js";
import { createObservabilityMiddleware } from "./observability.js";

const octokit = new Octokit({ auth: config.githubToken });

const SERVER_VERSION = "0.1.0";

export const server = new McpServer({ name: "github-workflow-mcp", version: SERVER_VERSION });

export function makeHealthCheck(linters: string[]) {
  return () => ({ status: "ok" as const, linters });
}

type KnowledgeSearcher = Awaited<ReturnType<typeof createKnowledgeSearcher>>;

async function registerAllTools(
  s: McpServer,
  auditLog: AuditLogger,
  actor: string,
  knowledgeSearcher: KnowledgeSearcher,
  cache: CacheClient,
): Promise<void> {
  registerRepositoryTools(s, octokit, config.githubOrg, config.allowedRepos, cache, config.cacheTtl);
  registerWorkTrackingTools(s, octokit, config.githubOrg, config.allowedRepos, cache, config.cacheTtl);
  registerPullRequestTools(s, octokit, config.githubOrg, config.allowedRepos, cache, config.cacheTtl);
  registerLintingTools(s, octokit, config.githubOrg, config.allowedRepos, config.allowWrites, auditLog, actor, config.lintCwd);
  registerGithubWriteTools(s, octokit, config.githubOrg, config.allowedRepos, config.allowWrites, auditLog, actor);
  registerReleaseTools(s, octokit, config.githubOrg, config.allowedRepos);
  registerCiTools(s, octokit, config.githubOrg, config.allowedRepos, config.allowWrites);
  await registerKnowledgeResources(s);
  registerKnowledgeTools(s, knowledgeSearcher);
}

async function buildMcpServer(auditLog: AuditLogger, actor: string, knowledgeSearcher: KnowledgeSearcher, cache: CacheClient, obs: ReturnType<typeof createObservabilityMiddleware>): Promise<McpServer> {
  const s = new McpServer({ name: "github-workflow-mcp", version: SERVER_VERSION });
  obs.instrument(s);
  await registerAllTools(s, auditLog, actor, knowledgeSearcher, cache);
  return s;
}

async function main() {
  const { log: auditLog, dashboard: auditDashboard } = await createAuditLogger(config.databaseUrl);
  const knowledgeSearcher = await createKnowledgeSearcher(config.databaseUrl);
  const cache = createCache(config.redisUrl);

  let actor = "unknown";
  if (config.databaseUrl) {
    try {
      const { data } = await octokit.users.getAuthenticated();
      actor = data.login;
    } catch { /* keep "unknown" if token cannot be resolved */ }
  }

  const linters = detectLinters("src/placeholder.ts", config.lintCwd);
  if (!linters.includes("eslint")) {
    logger.warn({ msg: "ESLint config not found — lint_code and apply_safe_fixes will return no results", lintCwd: config.lintCwd });
  }

  const obs = createObservabilityMiddleware(config.metricsInterval);
  obs.instrument(server);
  await registerAllTools(server, auditLog, actor, knowledgeSearcher, cache);

  const transports = config.port !== undefined ? ["stdio", "http"] : ["stdio"];
  logger.info({
    msg: "Starting MCP server",
    transports,
    org: config.githubOrg,
    allowedRepos: config.allowedRepos,
    allowWrites: config.allowWrites,
    auditEnabled: !!config.databaseUrl,
    cacheEnabled: !!config.redisUrl,
    linters,
  });

  if (config.port !== undefined) {
    await startHttpServer(
      config.port,
      () => buildMcpServer(auditLog, actor, knowledgeSearcher, cache, obs),
      makeHealthCheck(linters),
      { secret: config.mcpSecret, maxBodyBytes: config.maxBodyBytes, maxSessions: config.maxSessions, getAuditEntries: config.databaseUrl ? auditDashboard : undefined },
    );
  }

  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);

  logger.info({ msg: "MCP server connected", transport: "stdio" });
}

main().catch((err: Error) => {
  logger.error({ msg: "Server failed to start", error: err.message });
  process.exit(1);
});
