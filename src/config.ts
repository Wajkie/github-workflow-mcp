import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  githubToken: required("GITHUB_TOKEN"),
  githubOrg: required("GITHUB_ORG"),
  allowedRepos: optional("ALLOWED_REPOS", "*"),
  allowWrites: optional("ALLOW_WRITES", "false") === "true",
  logLevel: optional("LOG_LEVEL", "info"),
  port: process.env["PORT"] ? parseInt(process.env["PORT"], 10) : undefined,
  databaseUrl: process.env["DATABASE_URL"],
  redisUrl: process.env["REDIS_URL"],
  cacheTtl: {
    repos: parseInt(process.env["CACHE_TTL_REPOS"] ?? "300", 10),
    prs: parseInt(process.env["CACHE_TTL_PRS"] ?? "120", 10),
    issues: parseInt(process.env["CACHE_TTL_ISSUES"] ?? "120", 10),
    files: parseInt(process.env["CACHE_TTL_FILES"] ?? "600", 10),
  },
  metricsInterval: parseInt(process.env["METRICS_INTERVAL"] ?? "100", 10),
  mcpSecret: process.env["MCP_SECRET"],
  maxBodyBytes: parseInt(process.env["MAX_BODY_BYTES"] ?? "1048576", 10),
  maxSessions: parseInt(process.env["MAX_SESSIONS"] ?? "100", 10),
} as const;
