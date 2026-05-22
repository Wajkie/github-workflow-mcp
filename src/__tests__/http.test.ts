import { describe, it, expect, vi, beforeAll } from "vitest";
import { startHttpServer } from "../http.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const PORT = 19871;
const BASE = `http://localhost:${PORT}`;

function fakeFactory() {
  return Promise.resolve({
    connect: vi.fn().mockResolvedValue(undefined),
  } as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer);
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

describe("auth", () => {
  const PORT3 = 19873;
  const SECRET = "test-secret";

  beforeAll(async () => {
    await startHttpServer(PORT3, fakeFactory, () => ({ status: "ok" }), {
      secret: SECRET,
      maxBodyBytes: 1_048_576,
      maxSessions: 100,
    });
  });

  it("POST /mcp returns 401 when secret header is missing", async () => {
    const res = await fetch(`http://localhost:${PORT3}/mcp`, { method: "POST" });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  it("POST /mcp returns 401 when secret header is wrong", async () => {
    const res = await fetch(`http://localhost:${PORT3}/mcp`, {
      method: "POST",
      headers: { "x-mcp-secret": "wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("POST /mcp proceeds past auth when correct secret is provided", async () => {
    const res = await fetch(`http://localhost:${PORT3}/mcp`, {
      method: "POST",
      headers: { "x-mcp-secret": SECRET, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).not.toBe(401);
  });

  it("GET /health is not gated by the secret", async () => {
    const res = await fetch(`http://localhost:${PORT3}/health`);
    expect(res.status).toBe(200);
  });
});

describe("body size limit", () => {
  const PORT4 = 19874;

  beforeAll(async () => {
    await startHttpServer(PORT4, fakeFactory, () => ({ status: "ok" }), {
      maxBodyBytes: 100,
      maxSessions: 100,
    });
  });

  it("returns 413 when body exceeds maxBodyBytes", async () => {
    const largeBody = "x".repeat(200);
    const res = await fetch(`http://localhost:${PORT4}/mcp`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: largeBody,
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: "Request body too large" });
  });

  it("allows requests within the size limit", async () => {
    const smallBody = JSON.stringify({});
    const res = await fetch(`http://localhost:${PORT4}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: smallBody,
    });
    expect(res.status).not.toBe(413);
  });
});

describe("session cap", () => {
  const PORT5 = 19875;

  beforeAll(async () => {
    await startHttpServer(PORT5, fakeFactory, () => ({ status: "ok" }), {
      maxBodyBytes: 1_048_576,
      maxSessions: 0,
    });
  });

  it("returns 503 when session limit is reached", async () => {
    const res = await fetch(`http://localhost:${PORT5}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "Session limit reached" });
  });
});
