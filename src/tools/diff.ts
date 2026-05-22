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
