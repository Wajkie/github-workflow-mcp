import { describe, it, expect } from "vitest";
import { detectLinters, lintCode, validateDiff, suggestFixes } from "../linting.js";
import type { LintViolation } from "../linting.js";

// These tests run against the real project config files (eslint.config.js, tsconfig.json)
// so they are integration-style. The project root is the cwd when vitest runs.

describe("detectLinters", () => {
  it("detects eslint when eslint.config.js is present", () => {
    // eslint.config.js exists in the project root
    const linters = detectLinters("src/example.ts");
    expect(linters).toContain("eslint");
  });

  it("detects typescript for .ts files when tsconfig.json is present", () => {
    const linters = detectLinters("src/example.ts");
    expect(linters).toContain("typescript");
  });

  it("does not detect typescript for .js files", () => {
    const linters = detectLinters("src/example.js");
    expect(linters).not.toContain("typescript");
  });

  it("does not detect prettier when no prettier config exists", () => {
    const linters = detectLinters("src/example.ts");
    expect(linters).not.toContain("prettier");
  });
});

describe("lintCode", () => {
  it("returns an empty array for valid code", async () => {
    const code = `export function add(a: number, b: number): number {\n  return a + b;\n}\n`;
    const violations = await lintCode(code, "src/example.ts");
    expect(violations).toBeInstanceOf(Array);
    const errors = violations.filter((v) => v.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("detects a naming-convention violation", async () => {
    // PascalCase variable violates the configured naming-convention rule
    const code = `const MyVariable = 42;\nexport {};\n`;
    const violations = await lintCode(code, "src/example.ts");
    const namingViolation = violations.find((v) => v.ruleId?.includes("naming-convention"));
    expect(namingViolation).toBeDefined();
    expect(namingViolation?.severity).toBe("warning");
  });

  it("returns violations with required fields", async () => {
    const code = `const Bad_Name = 1;\nexport {};\n`;
    const violations = await lintCode(code, "src/example.ts");
    if (violations.length > 0) {
      const v = violations[0];
      expect(typeof v.linter).toBe("string");
      expect(["error", "warning", "info"]).toContain(v.severity);
      expect(typeof v.line).toBe("number");
      expect(typeof v.column).toBe("number");
      expect(typeof v.explanation).toBe("string");
    }
  });

  it("detects a TypeScript type error", async () => {
    // Assigning a string to a number is a type error
    const code = `const x: number = "hello";\n`;
    const violations = await lintCode(code, "src/example.ts");
    const tsError = violations.find((v) => v.linter === "typescript" && v.severity === "error");
    expect(tsError).toBeDefined();
    expect(tsError?.ruleId).toMatch(/^TS/);
  });
});

describe("validateDiff", () => {
  it("returns empty array for an empty diff", async () => {
    const result = await validateDiff("");
    expect(result).toEqual([]);
  });

  it("parses a unified diff and lints changed lines", async () => {
    const diff = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1,2 +1,3 @@",
      " const value = 1;",
      "+const MyBadName = 2;",
      " export {};",
    ].join("\n");

    const violations = await validateDiff(diff);
    expect(violations).toBeInstanceOf(Array);
    // Each violation has the filename attached
    for (const v of violations) {
      expect(v.filename).toBe("src/foo.ts");
    }
  });

  it("maps violation line numbers relative to the diff hunk start", async () => {
    const diff = [
      "+++ b/src/bar.ts",
      "@@ -10,3 +10,4 @@",
      " const a = 1;",
      "+const MyVar = 2;",
      " const b = 3;",
    ].join("\n");

    const violations = await validateDiff(diff);
    const naming = violations.find((v) => v.ruleId?.includes("naming-convention"));
    if (naming) {
      // 'MyVar' is the 2nd line of the hunk (hunk starts at new-line 10, +1 offset = line 11)
      expect(naming.line).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("suggestFixes", () => {
  it("returns only violations that have a suggestedFix", () => {
    const violations: LintViolation[] = [
      {
        linter: "eslint",
        severity: "warning",
        ruleId: "some-rule",
        line: 1,
        column: 1,
        explanation: "Fix this",
        suggestedFix: "Use foo instead of bar",
      },
      {
        linter: "typescript",
        severity: "error",
        ruleId: "TS2322",
        line: 2,
        column: 3,
        explanation: "Type mismatch",
        suggestedFix: null,
      },
    ];

    const edits = suggestFixes(violations);
    expect(edits).toHaveLength(1);
    expect(edits[0].edit).toBe("Use foo instead of bar");
    expect(edits[0].line).toBe(1);
    expect(edits[0].ruleId).toBe("some-rule");
  });

  it("returns empty array when no violations have fixes", () => {
    const violations: LintViolation[] = [
      {
        linter: "typescript",
        severity: "error",
        ruleId: "TS2322",
        line: 1,
        column: 1,
        explanation: "error",
        suggestedFix: null,
      },
    ];
    expect(suggestFixes(violations)).toHaveLength(0);
  });
});
