import { describe, it, expect, vi, beforeEach } from "vitest";
import { chunkMarkdown, createKnowledgeSearcher } from "../search.js";
import { wrapUntrustedContent } from "../../sanitize.js";

const mockQuery = vi.hoisted(() => vi.fn());
const mockReaddir = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockReadFile = vi.hoisted(() => vi.fn().mockResolvedValue(""));

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(function () {
    return { query: mockQuery };
  }),
}));

vi.mock("node:fs/promises", () => ({
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

describe("chunkMarkdown", () => {
  it("returns a single Introduction chunk for content with no headings", () => {
    const chunks = chunkMarkdown("conventions.md", "Some text here\nMore text");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].file).toBe("conventions");
    expect(chunks[0].section).toBe("Introduction");
  });

  it("splits on headings and strips .md from filename", () => {
    const md = "Intro text\n## Section One\nContent one\n## Section Two\nContent two";
    const chunks = chunkMarkdown("architecture.md", md);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].section).toBe("Introduction");
    expect(chunks[1].section).toBe("Section One");
    expect(chunks[2].section).toBe("Section Two");
    expect(chunks[0].file).toBe("architecture");
  });

  it("handles h1, h2, and h3 headings", () => {
    const md = "# Top\ntext\n## Mid\ntext\n### Sub\ntext";
    const chunks = chunkMarkdown("test.md", md);
    expect(chunks.map((c) => c.section)).toEqual(["Top", "Mid", "Sub"]);
  });

  it("omits chunks with very short content", () => {
    const md = "## Empty\n\n## Real\nSome real content here";
    const chunks = chunkMarkdown("test.md", md);
    expect(chunks.find((c) => c.section === "Real")).toBeDefined();
    expect(chunks.find((c) => c.section === "Empty")).toBeUndefined();
  });

  it("includes heading line in the chunk content", () => {
    const md = "## Naming\nUse camelCase for variables";
    const chunks = chunkMarkdown("conventions.md", md);
    expect(chunks[0].content).toContain("## Naming");
  });
});

describe("createKnowledgeSearcher", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
    mockReaddir.mockResolvedValue([]);
    mockReadFile.mockResolvedValue("");
  });

  it("returns a no-op searcher when databaseUrl is undefined", async () => {
    const searcher = await createKnowledgeSearcher(undefined);
    const result = await searcher.search("anything");
    expect("error" in result).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("sets up extension, chunks table, and files table on init", async () => {
    await createKnowledgeSearcher("postgresql://test");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("CREATE EXTENSION IF NOT EXISTS pg_trgm"),
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS knowledge_chunks"),
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS knowledge_files"),
    );
  });

  it("skips indexing a file whose content hash is unchanged", async () => {
    mockReaddir.mockResolvedValue(["conventions.md"]);
    mockReadFile.mockResolvedValue("# Naming\nUse camelCase");
    // Return a matching hash so the file should be skipped.
    // SHA-256("# Naming\nUse camelCase") computed at test time via the same crypto module.
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update("# Naming\nUse camelCase").digest("hex");
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SETUP_SQL
      .mockResolvedValueOnce({ rows: [{ content_hash: hash }] }); // SELECT content_hash

    await createKnowledgeSearcher("postgresql://test");

    // No DELETE or INSERT should have been issued for this file.
    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes("DELETE"))).toBe(false);
    expect(calls.some((s) => s.includes("INSERT INTO knowledge_chunks"))).toBe(false);
  });

  it("re-indexes a file when its content hash has changed", async () => {
    mockReaddir.mockResolvedValue(["conventions.md"]);
    mockReadFile.mockResolvedValue("# Naming\nUse camelCase");
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SETUP_SQL
      .mockResolvedValueOnce({ rows: [{ content_hash: "stale-hash" }] }) // SELECT content_hash
      .mockResolvedValue({ rows: [] }); // DELETE, INSERT, upsert knowledge_files

    await createKnowledgeSearcher("postgresql://test");

    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes("DELETE FROM knowledge_chunks"))).toBe(true);
    expect(calls.some((s) => s.includes("INSERT INTO knowledge_files"))).toBe(true);
  });

  it("indexes a file that has never been seen before", async () => {
    mockReaddir.mockResolvedValue(["new-doc.md"]);
    mockReadFile.mockResolvedValue("## Section\nSome content here");
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SETUP_SQL
      .mockResolvedValueOnce({ rows: [] }) // SELECT content_hash — no row
      .mockResolvedValue({ rows: [] });

    await createKnowledgeSearcher("postgresql://test");

    const calls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes("INSERT INTO knowledge_chunks"))).toBe(true);
    expect(calls.some((s) => s.includes("INSERT INTO knowledge_files"))).toBe(true);
  });

  it("search returns mapped results from the DB", async () => {
    const searcher = await createKnowledgeSearcher("postgresql://test");
    mockQuery.mockResolvedValueOnce({
      rows: [{ file: "conventions", section: "Naming", excerpt: "Use camelCase", score: 0.85 }],
    });
    const result = await searcher.search("naming");
    expect("results" in result).toBe(true);
    if ("results" in result) {
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        file: "conventions",
        section: "Naming",
        excerpt: wrapUntrustedContent("Use camelCase"),
        score: 0.85,
      });
    }
  });

  it("search rounds score to 2 decimal places", async () => {
    const searcher = await createKnowledgeSearcher("postgresql://test");
    mockQuery.mockResolvedValueOnce({
      rows: [{ file: "f", section: "s", excerpt: "e", score: 0.8567 }],
    });
    const result = await searcher.search("q");
    if ("results" in result) {
      expect(result.results[0].score).toBe(0.86);
    }
  });
});
