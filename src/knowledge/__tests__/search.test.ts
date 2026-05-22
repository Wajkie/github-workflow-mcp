import { describe, it, expect, vi, beforeEach } from "vitest";
import { chunkMarkdown, createKnowledgeSearcher } from "../search.js";

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(function () {
    return { query: mockQuery };
  }),
}));

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue(""),
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
  });

  it("returns a no-op searcher when databaseUrl is undefined", async () => {
    const searcher = await createKnowledgeSearcher(undefined);
    const result = await searcher.search("anything");
    expect("error" in result).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("sets up extension and table on init", async () => {
    await createKnowledgeSearcher("postgresql://test");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("CREATE EXTENSION IF NOT EXISTS pg_trgm"),
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS knowledge_chunks"),
    );
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
        excerpt: "Use camelCase",
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
