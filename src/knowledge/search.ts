import { Pool } from "pg";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeContent } from "./sanitize.js";

export interface SearchResult {
  file: string;
  section: string;
  excerpt: string;
  score: number;
}

export interface KnowledgeSearcher {
  search(query: string): Promise<{ results: SearchResult[] } | { error: string }>;
}

const knowledgeDir = fileURLToPath(new URL("../../knowledge", import.meta.url));

const SETUP_SQL = `
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id         BIGSERIAL PRIMARY KEY,
    file       TEXT NOT NULL,
    section    TEXT NOT NULL,
    content    TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS knowledge_chunks_content_trgm
    ON knowledge_chunks USING GIN (content gin_trgm_ops);
`;

const SEARCH_SQL = `
  SELECT file, section,
    CASE WHEN length(content) > 400 THEN left(content, 400) || '...' ELSE content END AS excerpt,
    word_similarity($1, content) AS score
  FROM knowledge_chunks
  WHERE $1 <% content
  ORDER BY score DESC
  LIMIT 10
`;

export function chunkMarkdown(
  filename: string,
  content: string,
): { file: string; section: string; content: string }[] {
  const file = filename.replace(/\.md$/, "");
  const lines = content.split("\n");
  const chunks: { file: string; section: string; content: string }[] = [];

  let section = "Introduction";
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text.length >= 10) chunks.push({ file, section, content: text });
    buffer = [];
  };

  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)/);
    if (m) {
      flush();
      section = m[1].trim();
      buffer = [line];
    } else {
      buffer.push(line);
    }
  }
  flush();

  return chunks;
}

async function indexFiles(pool: Pool): Promise<void> {
  const files = (await readdir(knowledgeDir)).filter((f) => f.endsWith(".md"));
  for (const filename of files) {
    const file = filename.replace(/\.md$/, "");
    const fileStat = await stat(join(knowledgeDir, filename));
    const { rows } = await pool.query<{ updated_at: Date }>(
      "SELECT MAX(updated_at) AS updated_at FROM knowledge_chunks WHERE file = $1",
      [file],
    );
    const lastIndexed = rows[0]?.updated_at;
    if (lastIndexed && fileStat.mtime <= lastIndexed) continue;

    const content = await readFile(join(knowledgeDir, filename), "utf-8");
    const chunks = chunkMarkdown(filename, content);
    await pool.query("DELETE FROM knowledge_chunks WHERE file = $1", [file]);
    for (const chunk of chunks) {
      await pool.query(
        "INSERT INTO knowledge_chunks (file, section, content) VALUES ($1, $2, $3)",
        [chunk.file, chunk.section, chunk.content],
      );
    }
  }
}

export async function createKnowledgeSearcher(
  databaseUrl: string | undefined,
): Promise<KnowledgeSearcher> {
  if (!databaseUrl) {
    return {
      search: async () => ({
        error: "Knowledge search requires a database connection. Set DATABASE_URL to enable it.",
      }),
    };
  }

  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query(SETUP_SQL);
  await indexFiles(pool);

  return {
    search: async (query: string) => {
      const { rows } = await pool.query<{
        file: string;
        section: string;
        excerpt: string;
        score: number;
      }>(SEARCH_SQL, [query]);
      return {
        results: rows.map((r) => ({
          file: r.file,
          section: r.section,
          excerpt: sanitizeContent(r.excerpt),
          score: Math.round(r.score * 100) / 100,
        })),
      };
    },
  };
}
