import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KnowledgeSearcher } from "../knowledge/search.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerKnowledgeTools(server: McpServer, searcher: KnowledgeSearcher): void {
  server.registerTool(
    "search_knowledge",
    {
      description:
        "Search the engineering knowledge base — returns ranked excerpts with source file and section heading",
      inputSchema: { query: z.string().describe("Search terms") },
    },
    async ({ query }) => {
      const result = await searcher.search(query);
      return ok(result);
    },
  );
}
