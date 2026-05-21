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
} as const;
