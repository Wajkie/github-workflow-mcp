import { describe, it, expect, vi, beforeEach } from "vitest";
import { categorizeError, createObservabilityMiddleware } from "../observability.js";

const mockWrite = vi.hoisted(() => vi.fn());

vi.mock("../logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: mockWrite,
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("categorizeError", () => {
  it("classifies 401 as auth", () => {
    expect(categorizeError({ status: 401 })).toBe("auth");
  });

  it("classifies 403 as auth", () => {
    expect(categorizeError({ status: 403 })).toBe("auth");
  });

  it("classifies 422 as validation", () => {
    expect(categorizeError({ status: 422 })).toBe("validation");
  });

  it("classifies other status codes as github_api", () => {
    expect(categorizeError({ status: 404 })).toBe("github_api");
    expect(categorizeError({ status: 500 })).toBe("github_api");
  });

  it("classifies ZodError as validation", () => {
    const err = new Error("bad input");
    err.name = "ZodError";
    expect(categorizeError(err)).toBe("validation");
  });

  it("classifies plain Error as internal", () => {
    expect(categorizeError(new Error("oops"))).toBe("internal");
  });

  it("classifies non-Error unknown as internal", () => {
    expect(categorizeError("string error")).toBe("internal");
  });
});

describe("createObservabilityMiddleware", () => {
  beforeEach(() => {
    mockWrite.mockClear();
  });

  function makeServer() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registered: Record<string, (...args: any[]) => Promise<unknown>> = {};
    return {
      registerTool(name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<unknown>) {
        registered[name] = handler;
      },
      call(name: string, ...args: unknown[]) {
        return registered[name]!(...args);
      },
    };
  }

  it("logs a success invocation line", async () => {
    const obs = createObservabilityMiddleware(100);
    const server = makeServer();
    obs.instrument(server as never);
    server.registerTool("my_tool", {}, async () => ({ content: [] }));

    await server.call("my_tool");

    const call = mockWrite.mock.calls.find((c) => c[0]?.msg === "tool_invocation");
    expect(call).toBeDefined();
    expect(call![0]).toMatchObject({ msg: "tool_invocation", tool: "my_tool", outcome: "success" });
    expect(typeof call![0].requestId).toBe("string");
    expect(typeof call![0].durationMs).toBe("number");
  });

  it("logs an error invocation with category when handler throws", async () => {
    const obs = createObservabilityMiddleware(100);
    const server = makeServer();
    obs.instrument(server as never);
    server.registerTool("fail_tool", {}, async () => {
      throw Object.assign(new Error("not found"), { status: 404 });
    });

    await expect(server.call("fail_tool")).rejects.toThrow("not found");

    const call = mockWrite.mock.calls.find((c) => c[0]?.msg === "tool_invocation");
    expect(call![0]).toMatchObject({ outcome: "error", errorCategory: "github_api" });
  });

  it("emits metrics_summary after interval calls", async () => {
    const obs = createObservabilityMiddleware(3);
    const server = makeServer();
    obs.instrument(server as never);
    server.registerTool("t", {}, async () => ({ content: [] }));

    await server.call("t");
    await server.call("t");
    expect(mockWrite.mock.calls.find((c) => c[0]?.msg === "metrics_summary")).toBeUndefined();

    await server.call("t");
    const summary = mockWrite.mock.calls.find((c) => c[0]?.msg === "metrics_summary");
    expect(summary).toBeDefined();
    expect(summary![0]).toMatchObject({ totalCalls: 3, tools: { t: { count: 3 } } });
    expect(summary![0].tools.t.p50Ms).toBeGreaterThanOrEqual(0);
    expect(summary![0].tools.t.p95Ms).toBeGreaterThanOrEqual(0);
  });

  it("emitSummary can be called explicitly", () => {
    const obs = createObservabilityMiddleware(100);
    obs.emitSummary();
    const summary = mockWrite.mock.calls.find((c) => c[0]?.msg === "metrics_summary");
    expect(summary).toBeDefined();
    expect(summary![0].totalCalls).toBe(0);
  });

  it("each invocation has a unique requestId", async () => {
    const obs = createObservabilityMiddleware(100);
    const server = makeServer();
    obs.instrument(server as never);
    server.registerTool("t", {}, async () => ({ content: [] }));

    await server.call("t");
    await server.call("t");

    const calls = mockWrite.mock.calls.filter((c) => c[0]?.msg === "tool_invocation");
    expect(calls).toHaveLength(2);
    expect(calls[0]![0].requestId).not.toBe(calls[1]![0].requestId);
  });

  it("tracks multiple tools independently in summary", async () => {
    const obs = createObservabilityMiddleware(100);
    const server = makeServer();
    obs.instrument(server as never);
    server.registerTool("a", {}, async () => ({ content: [] }));
    server.registerTool("b", {}, async () => ({ content: [] }));

    await server.call("a");
    await server.call("b");
    await server.call("b");
    obs.emitSummary();

    const summary = mockWrite.mock.calls.find((c) => c[0]?.msg === "metrics_summary");
    expect(summary![0].tools.a.count).toBe(1);
    expect(summary![0].tools.b.count).toBe(2);
  });
});
