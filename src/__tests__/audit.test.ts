import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuditLogger } from "../audit.js";

const mockQuery = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(function () {
    return { query: mockQuery };
  }),
}));

describe("createAuditLogger", () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  it("returns a no-op when databaseUrl is undefined", async () => {
    const log = await createAuditLogger(undefined);
    await log({ tool: "create_branch", inputs: {}, outcome: "success", actor: "bot" });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("creates the audit_log table on init", async () => {
    await createAuditLogger("postgresql://test");
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS audit_log"));
  });

  it("inserts a success record", async () => {
    const log = await createAuditLogger("postgresql://test");
    mockQuery.mockClear();
    await log({ tool: "create_branch", inputs: { repo: "r", branch_name: "b", base: "main" }, outcome: "success", actor: "alice" });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO audit_log"),
      ["create_branch", expect.any(String), "success", null, "alice"],
    );
  });

  it("inserts an error record with error message", async () => {
    const log = await createAuditLogger("postgresql://test");
    mockQuery.mockClear();
    await log({ tool: "merge_pr", inputs: { repo: "r", pr_number: 1 }, outcome: "error", error: "Not found", actor: "alice" });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO audit_log"),
      ["merge_pr", expect.any(String), "error", "Not found", "alice"],
    );
  });
});
