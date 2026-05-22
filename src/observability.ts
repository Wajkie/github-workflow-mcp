import { randomUUID } from "crypto";
import { logger } from "./logger.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ErrorCategory = "github_api" | "validation" | "auth" | "internal";

export function categorizeError(err: unknown): ErrorCategory {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status: number }).status;
    if (status === 401 || status === 403) return "auth";
    if (status === 422) return "validation";
    return "github_api";
  }
  if (err instanceof Error && err.name === "ZodError") return "validation";
  return "internal";
}

interface ToolMetrics {
  count: number;
  latencies: number[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx]!;
}

export function createObservabilityMiddleware(interval: number) {
  const metrics = new Map<string, ToolMetrics>();
  let totalCalls = 0;

  function getOrCreate(tool: string): ToolMetrics {
    let m = metrics.get(tool);
    if (!m) {
      m = { count: 0, latencies: [] };
      metrics.set(tool, m);
    }
    return m;
  }

  function emitSummary(): void {
    const tools: Record<string, { count: number; p50Ms: number; p95Ms: number }> = {};
    for (const [tool, m] of metrics) {
      const sorted = [...m.latencies].sort((a, b) => a - b);
      tools[tool] = {
        count: m.count,
        p50Ms: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95),
      };
    }
    logger.info({ msg: "metrics_summary", totalCalls, tools });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyHandler = (...args: any[]) => Promise<unknown>;

  function wrapHandler(toolName: string, handler: AnyHandler): AnyHandler {
    return async (...args: unknown[]) => {
      const requestId = randomUUID();
      const start = Date.now();
      try {
        const result = await handler(...args);
        const durationMs = Date.now() - start;
        logger.info({ msg: "tool_invocation", tool: toolName, requestId, durationMs, outcome: "success" });
        const m = getOrCreate(toolName);
        m.count++;
        m.latencies.push(durationMs);
        totalCalls++;
        if (totalCalls % interval === 0) emitSummary();
        return result;
      } catch (err) {
        const durationMs = Date.now() - start;
        const errorCategory = categorizeError(err);
        logger.info({ msg: "tool_invocation", tool: toolName, requestId, durationMs, outcome: "error", errorCategory });
        const m = getOrCreate(toolName);
        m.count++;
        m.latencies.push(durationMs);
        totalCalls++;
        if (totalCalls % interval === 0) emitSummary();
        throw err;
      }
    };
  }

  type PatchableServer = {
    registerTool: (name: string, config: unknown, handler: AnyHandler) => unknown;
  };

  function instrument(server: McpServer): void {
    const s = server as unknown as PatchableServer;
    const original = s.registerTool.bind(s);
    s.registerTool = (name: string, config: unknown, handler: AnyHandler) =>
      original(name, config, wrapHandler(name, handler));
  }

  return { instrument, emitSummary };
}
