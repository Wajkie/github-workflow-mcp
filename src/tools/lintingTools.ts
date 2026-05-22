import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getChangedFiles } from "./pullRequest.js";
import {
  lintCode,
  validateDiff,
  validatePrFiles,
  suggestFixes,
  applyAutofix,
  generateUnifiedDiff,
  type LintViolation,
} from "./linting.js";
import { denied, isRepoAllowed } from "./allowlist.js";
import { writeDenied } from "./writeGate.js";
import { createBranch, writeFileToRepo } from "./githubWrite.js";
import type { AuditLogger } from "../audit.js";
import { ok, toErrorContent } from "./response.js";

export function registerLintingTools(
  server: McpServer,
  octokit: Octokit,
  org: string,
  allowedRepos = "*",
  allowWrites = false,
  auditLog: AuditLogger = async () => {},
  actor = "unknown",
  lintCwd = process.cwd(),
) {
  server.registerTool(
    "lint_code",
    {
      description:
        "Lint a string of code inline. Filename is used to infer the language and resolve config (eslint.config.js, tsconfig.json). Returns violations with severity, rule id, line, and suggested fix. Use before committing or when reviewing a code snippet.",
      inputSchema: {
        content: z.string().describe("Source code to lint"),
        filename: z
          .string()
          .describe(
            "Filename (e.g. 'src/utils.ts'). Used to select the linter and resolve config — the file does not need to exist on disk.",
          ),
      },
    },
    async ({ content, filename }) => {
      try {
        const violations = await lintCode(content, filename, lintCwd);
        return ok(violations);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "validate_diff",
    {
      description:
        "Lint a unified diff string (e.g. from git diff). Each added/changed hunk is linted in context. Returns violations mapped to their new-file line numbers. Use when you have a diff but not the full file.",
      inputSchema: {
        diff: z.string().describe("Unified diff string (output of git diff or similar)"),
      },
    },
    async ({ diff }) => {
      try {
        const violations = await validateDiff(diff, lintCwd);
        return ok(violations);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "validate_pr",
    {
      description:
        "Fetch a pull request's changed files from GitHub and lint the modified content. Returns violations grouped by filename. Use to check a PR for lint errors before reviewing or merging.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        pr_number: z.number().describe("Pull request number"),
      },
    },
    async ({ repo, pr_number: prNumber }) => {
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const files = await getChangedFiles(octokit, org, repo, prNumber);
        const violations = await validatePrFiles(files, lintCwd);
        return ok(violations);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "suggest_fixes",
    {
      description:
        "Convert lint violations into structured edit suggestions. Returns only violations that have a fixable suggestion. Never writes to disk — use apply_safe_fixes to commit changes.",
      inputSchema: {
        violations: z
          .array(
            z.object({
              linter: z.string(),
              severity: z.enum(["error", "warning", "info"]),
              ruleId: z.string().nullable(),
              line: z.number(),
              column: z.number(),
              explanation: z.string(),
              suggestedFix: z.string().nullable(),
            }),
          )
          .describe("Violations from lint_code, validate_diff, or validate_pr"),
      },
    },
    async ({ violations }) => {
      try {
        const edits = suggestFixes(violations as LintViolation[]);
        return ok(edits);
      } catch (err) {
        return toErrorContent(err);
      }
    },
  );

  server.registerTool(
    "apply_safe_fixes",
    {
      description:
        "Apply ESLint autofixable rules (formatting, import ordering, whitespace) and commit the result to a new branch. Returns a unified diff of the changes. Never modifies logic, types, or renames. Requires ALLOW_WRITES=true — use suggest_fixes first if unsure what will change.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        path: z.string().describe("File path within the repository (e.g. 'src/utils.ts')"),
        content: z.string().describe("Current file content to fix"),
        base_branch: z.string().describe("Branch to base the fix branch on (e.g. 'main')"),
        branch_name: z
          .string()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9._\-/]*$/, "Branch name may only contain letters, numbers, hyphens, underscores, dots, and slashes")
          .describe("Name for the new branch that will contain the fixes"),
      },
    },
    async ({ repo, path, content, base_branch: baseBranch, branch_name: branchName }) => {
      if (!allowWrites) return writeDenied();
      if (!isRepoAllowed(repo, allowedRepos)) return denied(repo);
      try {
        const { fixed, fixApplied } = await applyAutofix(content, path, lintCwd);
        if (!fixApplied) {
          return ok({ message: "No autofixable violations found. No changes were made.", diff: "" });
        }
        await createBranch(octokit, org, repo, branchName, baseBranch);
        await writeFileToRepo(
          octokit, org, repo, path, fixed,
          `fix(lint): apply safe autofixes to ${path}`,
          branchName,
        );
        const diff = generateUnifiedDiff(content, fixed, path);
        await auditLog({
          tool: "apply_safe_fixes",
          inputs: { repo, path, base_branch: baseBranch, branch_name: branchName },
          outcome: "success",
          actor,
        });
        return ok({ branch: branchName, diff });
      } catch (err) {
        await auditLog({
          tool: "apply_safe_fixes",
          inputs: { repo, path, base_branch: baseBranch, branch_name: branchName },
          outcome: "error",
          error: String(err),
          actor,
        });
        return toErrorContent(err);
      }
    },
  );
}
