import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const knowledgeDir = fileURLToPath(new URL("../../knowledge", import.meta.url));

const RESOURCES = [
  {
    name: "engineering-index",
    slug: "index",
    file: "index.md",
    description: "Knowledge base index — which file to load for which task",
  },
  {
    name: "engineering-conventions",
    slug: "conventions",
    file: "conventions.md",
    description: "Universal TypeScript coding standards, naming, and file patterns",
  },
  {
    name: "engineering-react-conventions",
    slug: "react-conventions",
    file: "reactConventions.md",
    description: "React/Vite component structure, hooks, and folder layout",
  },
  {
    name: "engineering-architecture",
    slug: "architecture",
    file: "architecture.md",
    description: "System design decisions and component overview",
  },
  {
    name: "engineering-examples",
    slug: "examples",
    file: "examples.md",
    description: "Concrete code patterns and reference snippets",
  },
  {
    name: "engineering-review-checklist",
    slug: "review-checklist",
    file: "review-checklist.md",
    description: "What reviewers check before approving a PR",
  },
  {
    name: "engineering-release-process",
    slug: "release-process",
    file: "release-process.md",
    description: "How releases are cut and deployed",
  },
];

export function registerKnowledgeResources(server: McpServer): void {
  for (const r of RESOURCES) {
    const uri = `engineering:///${r.slug}`;
    server.registerResource(
      r.name,
      uri,
      { description: r.description, mimeType: "text/markdown" },
      async (resourceUri) => {
        const text = await readFile(join(knowledgeDir, r.file), "utf-8");
        return {
          contents: [{ uri: resourceUri.toString(), mimeType: "text/markdown", text }],
        };
      },
    );
  }
}
