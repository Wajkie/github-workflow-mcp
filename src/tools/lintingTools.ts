import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";
import { getChangedFiles } from "./pullRequest.js";
import {
  lintCode,
  validateDiff,
  validatePrFiles,
  suggestFixes,
  type LintViolation,
} from "./linting.js";
import { ok, toErrorContent } from "./response.js";

export function registerLintingTools(server: McpServer, octokit: Octokit, org: string) {
  server.registerTool(
    "lint_code",
    {
      description:
        "Lint a string of code inline. The filename is used to infer the language and resolve linter config (eslint.config.js, tsconfig.json, etc.). Returns violations with severity, rule id, line, and suggested fix.",
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
        const violations = await lintCode(content, filename);
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
        "Lint a unified diff string (e.g. from git diff). Each added/changed hunk is linted in context. Returns violations mapped to their new-file line numbers.",
      inputSchema: {
        diff: z.string().describe("Unified diff string (output of git diff or similar)"),
      },
    },
    async ({ diff }) => {
      try {
        const violations = await validateDiff(diff);
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
        "Fetch a pull request's changed files from GitHub and lint the modified content. Returns violations grouped by filename.",
      inputSchema: {
        repo: z.string().describe("Repository name (without owner prefix)"),
        pr_number: z.number().describe("Pull request number"),
      },
    },
    async ({ repo, pr_number }) => {
      try {
        const files = await getChangedFiles(octokit, org, repo, pr_number);
        const violations = await validatePrFiles(files);
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
        "Convert lint violations into structured edit suggestions. Returns only violations that have a suggested fix. Never writes to disk.",
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
}
