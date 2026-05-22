import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./logger.js";

export interface HttpServerOptions {
  secret?: string;
  maxBodyBytes: number;
  maxSessions: number;
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
    void dispatch(req, res, port, transports, serverFactory, getHealth, options);
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
  options: HttpServerOptions,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (req.method === "GET" && url.pathname === "/health") {
    jsonResponse(res, 200, getHealth());
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
    });
    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId);
    };
    const mcpServer = await serverFactory();
    await mcpServer.connect(transport);
    if (transport.sessionId) {
      transports.set(transport.sessionId, transport);
    }
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}
