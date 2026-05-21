import { describe, it, expect, vi, beforeAll } from "vitest";
import { startHttpServer } from "../http.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const PORT = 19871;
const BASE = `http://localhost:${PORT}`;

function fakeFactory() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
  } as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer;
}

describe("startHttpServer", () => {
  beforeAll(async () => {
    await startHttpServer(PORT, fakeFactory, () => ({ status: "ok" }));
  });

  it("GET /health returns 200 with { status: 'ok' }", async () => {
    const res = await fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("GET /health uses the getHealth callback value", async () => {
    const PORT2 = 19872;
    await startHttpServer(PORT2, fakeFactory, () => ({ status: "ok", version: "1.2.3" }));
    const res = await fetch(`http://localhost:${PORT2}/health`);
    expect(await res.json()).toMatchObject({ version: "1.2.3" });
  });

  it("unknown path returns 404", async () => {
    const res = await fetch(`${BASE}/unknown`);
    expect(res.status).toBe(404);
  });
});
