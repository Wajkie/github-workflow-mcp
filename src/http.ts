import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./logger.js";
import type { AuditDashboard, AuditRow } from "./audit.js";

export interface HttpServerOptions {
  secret?: string;
  maxBodyBytes: number;
  maxSessions: number;
  getAuditEntries?: AuditDashboard;
}

const DEFAULT_OPTIONS: HttpServerOptions = { maxBodyBytes: 1_048_576, maxSessions: 100 };

export async function startHttpServer(
  port: number,
  serverFactory: () => Promise<McpServer>,
  getHealth: () => object,
  options: HttpServerOptions = DEFAULT_OPTIONS,
): Promise<void> {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer((req, res) => {
    void dispatch(req, res, port, transports, serverFactory, getHealth, options.getAuditEntries, options);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, () => resolve());
  });

  logger.info({ msg: "HTTP transport listening", port });
}

function jsonResponse(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function dispatch(
  req: IncomingMessage,
  res: ServerResponse,
  port: number,
  transports: Map<string, StreamableHTTPServerTransport>,
  serverFactory: () => Promise<McpServer>,
  getHealth: () => object,
  getAuditEntries: AuditDashboard | undefined,
  options: HttpServerOptions,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (req.method === "GET" && url.pathname === "/health") {
    jsonResponse(res, 200, getHealth());
    return;
  }

  if (req.method === "GET" && url.pathname === "/audit") {
    await handleAuditDashboard(req, res, url, getAuditEntries);
    return;
  }

  if (url.pathname === "/mcp") {
    if (options.secret) {
      const provided = req.headers["x-mcp-secret"];
      if (provided !== options.secret) {
        jsonResponse(res, 401, { error: "Unauthorized" });
        return;
      }
    }

    const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
    if (!isNaN(contentLength) && contentLength > options.maxBodyBytes) {
      jsonResponse(res, 413, { error: "Request body too large" });
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const transport = transports.get(sessionId);
      if (!transport) {
        jsonResponse(res, 404, { error: "Session not found" });
        return;
      }
      await transport.handleRequest(req, res);
      return;
    }

    if (transports.size >= options.maxSessions) {
      jsonResponse(res, 503, { error: "Session limit reached" });
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports.set(sid, transport);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId);
    };
    const mcpServer = await serverFactory();
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}

async function handleAuditDashboard(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  getAuditEntries: AuditDashboard | undefined,
): Promise<void> {
  const rows = getAuditEntries ? await getAuditEntries(100) : [];
  const noDb = !getAuditEntries;

  if (url.searchParams.get("format") === "json") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(rows));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderAuditHtml(rows, noDb));
}

function renderAuditHtml(rows: AuditRow[], noDb: boolean): string {
  const banner = noDb
    ? `<div class="banner">No database configured — audit logging is disabled.</div>`
    : "";

  const tableRows = rows.length === 0
    ? `<tr><td colspan="6" class="empty">No audit entries yet.</td></tr>`
    : rows.map((r) => `
      <tr class="${r.outcome === "error" ? "err" : ""}">
        <td>${escHtml(String(r.id))}</td>
        <td>${escHtml(r.tool_name)}</td>
        <td>${escHtml(r.actor)}</td>
        <td>${escHtml(r.outcome)}</td>
        <td class="msg">${escHtml(r.error_msg ?? "")}</td>
        <td>${escHtml(new Date(r.created_at).toISOString())}</td>
      </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Audit Log — github-workflow-mcp</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 1rem 2rem; background: #f8f9fa; color: #212529; }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    .banner { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 0.5rem 1rem; margin-bottom: 1rem; }
    table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    th { background: #343a40; color: #fff; text-align: left; padding: 0.5rem 0.75rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: .05em; }
    td { padding: 0.45rem 0.75rem; border-bottom: 1px solid #dee2e6; font-size: 0.85rem; vertical-align: top; }
    tr.err td { background: #fff5f5; color: #c00; }
    td.msg { max-width: 300px; word-break: break-word; }
    td.empty { text-align: center; color: #6c757d; padding: 2rem; }
    .refresh { font-size: 0.75rem; color: #6c757d; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h1>Audit Log</h1>
  ${banner}
  <table>
    <thead><tr>
      <th>ID</th><th>Tool</th><th>Actor</th><th>Outcome</th><th>Error</th><th>Timestamp</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <p class="refresh">Auto-refreshes every 30 s &mdash; <a href="?format=json">JSON</a></p>
  <script>
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
