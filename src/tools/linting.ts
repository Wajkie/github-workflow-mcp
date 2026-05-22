import { existsSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, basename, join } from "node:path";
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

const ESLINT_CONFIGS = [
  "eslint.config.js", "eslint.config.mjs", "eslint.config.cjs",
  ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yaml", ".eslintrc.yml",
];

const PRETTIER_CONFIGS = [
  ".prettierrc", ".prettierrc.json", ".prettierrc.js", ".prettierrc.cjs",
  ".prettierrc.yaml", ".prettierrc.yml", "prettier.config.js", "prettier.config.cjs",
];

export function detectLinters(filename: string): string[] {
  const linters: string[] = [];
  const ext = extname(filename);
  const cwd = process.cwd();
  if (ESLINT_CONFIGS.some((f) => existsSync(join(cwd, f)))) linters.push("eslint");
  if ([".ts", ".tsx"].includes(ext) && existsSync(join(cwd, "tsconfig.json"))) linters.push("typescript");
  if (PRETTIER_CONFIGS.some((f) => existsSync(join(cwd, f)))) linters.push("prettier");
  if (existsSync(join(cwd, "biome.json")) || existsSync(join(cwd, "biome.jsonc"))) linters.push("biome");
  return linters;
}

async function lintWithEslint(content: string, filePath: string): Promise<LintViolation[]> {
  try {
    const eslint = new ESLint();
    const [result] = await eslint.lintText(content, { filePath });
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
  } catch {
    return [];
  }
}

// Suppress "cannot find module/name" noise — expected when linting inline snippets
const MODULE_RESOLUTION_CODES = new Set([2304, 2305, 2306, 2307, 2308, 2309, 7016, 7026]);

async function lintWithTypescript(content: string, filename: string): Promise<LintViolation[]> {
  const tmpFile = join(tmpdir(), `mcp-ts-${Date.now()}-${basename(filename)}`);
  try {
    await writeFile(tmpFile, content, "utf-8");
    const program = ts.createProgram([tmpFile], {
      noEmit: true, strict: true, target: ts.ScriptTarget.ESNext, skipLibCheck: true,
    });
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

export async function lintCode(content: string, filename: string): Promise<LintViolation[]> {
  const linters = detectLinters(filename);
  const all: LintViolation[] = [];
  if (linters.includes("eslint")) all.push(...(await lintWithEslint(content, filename)));
  if (linters.includes("typescript")) all.push(...(await lintWithTypescript(content, filename)));
  return all.sort((a, b) => a.line - b.line || a.column - b.column);
}

export async function applyAutofix(
  content: string,
  filePath: string,
): Promise<{ fixed: string; fixApplied: boolean }> {
  try {
    const eslint = new ESLint({ fix: true });
    const [result] = await eslint.lintText(content, { filePath });
    if (!result) return { fixed: content, fixApplied: false };
    const fixed = result.output ?? content;
    return { fixed, fixApplied: fixed !== content };
  } catch {
    return { fixed: content, fixApplied: false };
  }
}

function lcsMatrix(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

type DiffOp = { op: "eq" | "del" | "ins"; line: string };

function buildDiffOps(a: string[], b: string[]): DiffOp[] {
  const dp = lcsMatrix(a, b);
  const ops: DiffOp[] = [];
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ op: "eq", line: a[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ op: "ins", line: b[j - 1] }); j--;
    } else {
      ops.unshift({ op: "del", line: a[i - 1] }); i--;
    }
  }
  return ops;
}

export function generateUnifiedDiff(original: string, fixed: string, filename: string): string {
  if (original === fixed) return "";
  const a = original.split("\n");
  const b = fixed.split("\n");
  const ops = buildDiffOps(a, b);

  const CONTEXT = 3;
  const changes: number[] = [];
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].op !== "eq") changes.push(k);
  }
  if (changes.length === 0) return "";

  const header = [`--- a/${filename}`, `+++ b/${filename}`];
  const hunks: string[] = [];

  let ci = 0;
  while (ci < changes.length) {
    const hunkStart = Math.max(0, changes[ci] - CONTEXT);
    let hunkEnd = changes[ci] + CONTEXT;
    while (ci < changes.length && changes[ci] <= hunkEnd + 1) {
      hunkEnd = changes[ci] + CONTEXT;
      ci++;
    }
    hunkEnd = Math.min(ops.length - 1, hunkEnd);

    let oldLine = 1, newLine = 1;
    for (let i = 0; i < hunkStart; i++) {
      if (ops[i].op !== "ins") oldLine++;
      if (ops[i].op !== "del") newLine++;
    }
    let oldCount = 0, newCount = 0;
    for (let i = hunkStart; i <= hunkEnd; i++) {
      if (ops[i].op !== "ins") oldCount++;
      if (ops[i].op !== "del") newCount++;
    }

    const hunkLines = [`@@ -${oldLine},${oldCount} +${newLine},${newCount} @@`];
    for (let i = hunkStart; i <= hunkEnd; i++) {
      const { op, line } = ops[i];
      hunkLines.push(op === "eq" ? ` ${line}` : op === "del" ? `-${line}` : `+${line}`);
    }
    hunks.push(hunkLines.join("\n"));
  }

  return [...header, ...hunks].join("\n");
}

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

export async function validateDiff(diff: string): Promise<DiffViolation[]> {
  const files = parseUnifiedDiff(diff);
  const results: DiffViolation[] = [];
  for (const file of files) {
    for (const hunk of file.hunks) {
      const content = hunk.lines.join("\n");
      if (!content.trim()) continue;
      const violations = await lintCode(content, file.filename);
      for (const v of violations) {
        results.push({ ...v, filename: file.filename, line: hunk.startLine + v.line - 1 });
      }
    }
  }
  return results;
}

export async function validatePrFiles(
  files: Array<{ filename: string; patch: string | null }>,
): Promise<DiffViolation[]> {
  const results: DiffViolation[] = [];
  for (const file of files) {
    if (!file.patch) continue;
    // Reconstruct a minimal unified diff so we can reuse parseUnifiedDiff
    const violations = await validateDiff(`+++ b/${file.filename}\n${file.patch}`);
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
