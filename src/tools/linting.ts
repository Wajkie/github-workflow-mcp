import { existsSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { extname, basename, join, resolve, relative, isAbsolute } from "node:path";
import { ESLint } from "eslint";
import ts from "typescript";

export interface LintViolation {
  linter: string;
  severity: "error" | "warning" | "info";
  ruleId: string | null;
  line: number;
  column: number;
  explanation: string;
  suggestedFix: string | null;
}

export interface DiffViolation extends LintViolation {
  filename: string;
}

export interface StructuredEdit {
  line: number;
  column: number;
  ruleId: string | null;
  description: string;
  edit: string | null;
}

export const ESLINT_FLAT_CONFIGS = [
  "eslint.config.js", "eslint.config.mjs", "eslint.config.cjs",
];

export const ESLINT_CONFIGS = [
  ...ESLINT_FLAT_CONFIGS,
  ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yaml", ".eslintrc.yml",
];

const MAX_LINT_BYTES = 100_000;

const PRETTIER_CONFIGS = [
  ".prettierrc", ".prettierrc.json", ".prettierrc.js", ".prettierrc.cjs",
  ".prettierrc.yaml", ".prettierrc.yml", "prettier.config.js", "prettier.config.cjs",
];

function safeLintPath(filename: string, lintCwd: string): string {
  const resolved = resolve(lintCwd, filename);
  const rel = relative(lintCwd, resolved);
  if (isAbsolute(rel) || rel.startsWith("..")) {
    return join(lintCwd, basename(filename));
  }
  return resolved;
}

export function detectLinters(filename: string, lintCwd = process.cwd()): string[] {
  const linters: string[] = [];
  const ext = extname(filename);
  if (ESLINT_CONFIGS.some((f) => existsSync(join(lintCwd, f)))) linters.push("eslint");
  if ([".ts", ".tsx"].includes(ext) && existsSync(join(lintCwd, "tsconfig.json"))) linters.push("typescript");
  if (PRETTIER_CONFIGS.some((f) => existsSync(join(lintCwd, f)))) linters.push("prettier");
  if (existsSync(join(lintCwd, "biome.json")) || existsSync(join(lintCwd, "biome.jsonc"))) linters.push("biome");
  return linters;
}

async function lintWithEslint(content: string, filePath: string, lintCwd: string): Promise<LintViolation[]> {
  const eslint = new ESLint({ cwd: lintCwd });
  const [result] = await eslint.lintText(content, { filePath: safeLintPath(filePath, lintCwd) });
  if (!result) return [];
  return result.messages.map((msg) => ({
    linter: "eslint",
    severity: msg.severity === 2 ? "error" : msg.severity === 1 ? "warning" : "info",
    ruleId: msg.ruleId ?? null,
    line: msg.line,
    column: msg.column,
    explanation: msg.message,
    suggestedFix: msg.suggestions?.[0]?.desc ?? null,
  }));
}

// Suppress "cannot find module/name" noise — expected when linting inline snippets
const MODULE_RESOLUTION_CODES = new Set([2304, 2305, 2306, 2307, 2308, 2309, 7016, 7026]);

async function lintWithTypescript(content: string, filename: string, lintCwd: string): Promise<LintViolation[]> {
  const tsconfigPath = join(lintCwd, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return [];
  const tmpFile = join(tmpdir(), `mcp-ts-${randomUUID()}-${basename(filename)}`);
  try {
    await writeFile(tmpFile, content, "utf-8");
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile) as { config: object; error?: ts.Diagnostic };
    const { options } = ts.parseJsonConfigFileContent(configFile.config, ts.sys, lintCwd);
    const program = ts.createProgram([tmpFile], { ...options, noEmit: true, skipLibCheck: true });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const normalizedTmp = tmpFile.replace(/\\/g, "/");
    return Array.from(diagnostics)
      .filter(
        (d) =>
          d.file !== undefined &&
          d.file.fileName.replace(/\\/g, "/") === normalizedTmp &&
          !MODULE_RESOLUTION_CODES.has(d.code),
      )
      .map((d) => {
        // d.file is defined — confirmed by filter above
        const { line, character } = d.file!.getLineAndCharacterOfPosition(d.start ?? 0);
        return {
          linter: "typescript",
          severity:
            d.category === ts.DiagnosticCategory.Error ? ("error" as const)
            : d.category === ts.DiagnosticCategory.Warning ? ("warning" as const)
            : ("info" as const),
          ruleId: `TS${d.code}`,
          line: line + 1,
          column: character + 1,
          explanation: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
          suggestedFix: null,
        };
      });
  } catch {
    return [];
  } finally {
    try { await unlink(tmpFile); } catch {}
  }
}

export async function lintCode(content: string, filename: string, lintCwd = process.cwd()): Promise<LintViolation[]> {
  if (content.length > MAX_LINT_BYTES) {
    throw new Error(`Content too large to lint (${content.length} bytes, limit ${MAX_LINT_BYTES})`);
  }
  const linters = detectLinters(filename, lintCwd);
  const all: LintViolation[] = [];
  if (linters.includes("eslint")) all.push(...(await lintWithEslint(content, filename, lintCwd)));
  if (linters.includes("typescript")) all.push(...(await lintWithTypescript(content, filename, lintCwd)));
  return all.sort((a, b) => a.line - b.line || a.column - b.column);
}

export async function applyAutofix(
  content: string,
  filePath: string,
  lintCwd = process.cwd(),
  overrideConfigFile?: string,
): Promise<{ fixed: string; fixApplied: boolean }> {
  const eslintOptions: ESLint.Options = { fix: true, cwd: lintCwd };
  if (overrideConfigFile) eslintOptions.overrideConfigFile = overrideConfigFile;
  const eslint = new ESLint(eslintOptions);
  const [result] = await eslint.lintText(content, { filePath: safeLintPath(filePath, lintCwd) });
  if (!result) return { fixed: content, fixApplied: false };
  const fixed = result.output ?? content;
  return { fixed, fixApplied: fixed !== content };
}

export { generateUnifiedDiff } from "./diff.js";

interface ParsedHunk { startLine: number; lines: string[] }
interface ParsedFile { filename: string; hunks: ParsedHunk[] }

function parseUnifiedDiff(diff: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  let current: ParsedFile | null = null;
  let currentHunk: ParsedHunk | null = null;
  let newLineNum = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      current = { filename: line.slice(4).replace(/^[ab]\//, ""), hunks: [] };
      files.push(current);
      currentHunk = null;
    } else if (line.startsWith("@@ ")) {
      const match = /\+(\d+)/.exec(line);
      newLineNum = match ? parseInt(match[1], 10) : 1;
      currentHunk = { startLine: newLineNum, lines: [] };
      current?.hunks.push(currentHunk);
    } else if (current && currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push(line.slice(1));
        newLineNum++;
      } else if (line.startsWith("-")) {
        // removed line — skip for new-file perspective
      } else if (!line.startsWith("\\")) {
        currentHunk.lines.push(line.length > 0 ? line.slice(1) : "");
        newLineNum++;
      }
    }
  }
  return files;
}

export async function validateDiff(diff: string, lintCwd = process.cwd()): Promise<DiffViolation[]> {
  if (diff.length > MAX_LINT_BYTES) {
    throw new Error(`Diff too large to lint (${diff.length} bytes, limit ${MAX_LINT_BYTES})`);
  }
  const files = parseUnifiedDiff(diff);
  const results: DiffViolation[] = [];
  for (const file of files) {
    for (const hunk of file.hunks) {
      const content = hunk.lines.join("\n");
      if (!content.trim()) continue;
      const violations = await lintCode(content, file.filename, lintCwd);
      for (const v of violations) {
        results.push({ ...v, filename: file.filename, line: hunk.startLine + v.line - 1 });
      }
    }
  }
  return results;
}

export async function validatePrFiles(
  files: Array<{ filename: string; patch: string | null }>,
  lintCwd = process.cwd(),
): Promise<DiffViolation[]> {
  const results: DiffViolation[] = [];
  for (const file of files) {
    if (!file.patch) continue;
    // Reconstruct a minimal unified diff so we can reuse parseUnifiedDiff
    const violations = await validateDiff(`+++ b/${file.filename}\n${file.patch}`, lintCwd);
    results.push(...violations);
  }
  return results;
}

export function suggestFixes(violations: LintViolation[]): StructuredEdit[] {
  return violations
    .filter((v) => v.suggestedFix !== null)
    .map((v) => ({
      line: v.line,
      column: v.column,
      ruleId: v.ruleId,
      description: v.explanation,
      edit: v.suggestedFix,
    }));
}
