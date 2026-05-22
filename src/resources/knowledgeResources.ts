import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { sanitizeContent } from "../knowledge/sanitize.js";

const knowledgeDir = fileURLToPath(new URL("../../knowledge", import.meta.url));

const KNOWN: Record<string, { name: string; slug: string; description: string }> = {
  "index.md": {
    name: "engineering-index",
    slug: "index",
    description: "Knowledge base index — which file to load for which task",
  },
  "conventions.md": {
    name: "engineering-conventions",
    slug: "conventions",
    description: "Universal TypeScript coding standards, naming, and file patterns",
  },
  "reactConventions.md": {
    name: "engineering-react-conventions",
    slug: "react-conventions",
    description: "React/Vite component structure, hooks, and folder layout",
  },
  "architecture.md": {
    name: "engineering-architecture",
    slug: "architecture",
    description: "System design decisions and component overview",
  },
  "examples.md": {
    name: "engineering-examples",
    slug: "examples",
    description: "Concrete code patterns and reference snippets",
  },
  "review-checklist.md": {
    name: "engineering-review-checklist",
    slug: "review-checklist",
    description: "What reviewers check before approving a PR",
  },
  "release-process.md": {
    name: "engineering-release-process",
    slug: "release-process",
    description: "How releases are cut and deployed",
  },
};

function toSlug(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`)
    .replace(/^-/, "");
}

export async function registerKnowledgeResources(server: McpServer): Promise<void> {
  const files = (await readdir(knowledgeDir)).filter((f) => f.endsWith(".md"));
  for (const filename of files) {
    const known = KNOWN[filename];
    const slug = known?.slug ?? toSlug(filename);
    const name = known?.name ?? `engineering-${slug}`;
    const description = known?.description ?? `Engineering knowledge: ${slug}`;
    const uri = `engineering:///${slug}`;
    server.registerResource(
      name,
      uri,
      { description, mimeType: "text/markdown" },
      async (resourceUri) => {
        const raw = await readFile(join(knowledgeDir, filename), "utf-8");
        const text = sanitizeContent(raw);
        return {
          contents: [{ uri: resourceUri.toString(), mimeType: "text/markdown", text }],
        };
      },
    );
  }
}
