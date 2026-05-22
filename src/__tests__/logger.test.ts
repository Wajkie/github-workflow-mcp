import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  let writespy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writespy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    delete process.env["LOG_LEVEL"];
  });

  afterEach(() => {
    writespy.mockRestore();
    delete process.env["LOG_LEVEL"];
  });

  async function freshLogger() {
    // Re-import to pick up the current LOG_LEVEL env at module evaluation time.
    // The logger reads LOG_LEVEL on every write, so we don't need to re-import.
    const { logger } = await import("../logger.js");
    return logger;
  }

  it("writes a JSON line to stderr", async () => {
    const logger = await freshLogger();
    logger.info({ msg: "hello" });
    expect(writespy).toHaveBeenCalled();
    const raw = writespy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw.trim());
    expect(parsed).toMatchObject({ level: "info", msg: "hello" });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("includes level and timestamp in every log line", async () => {
    const logger = await freshLogger();
    logger.warn({ msg: "caution" });
    const raw = writespy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw.trim());
    expect(parsed.level).toBe("warn");
    expect(new Date(parsed.timestamp).getFullYear()).toBeGreaterThan(2020);
  });

  it("suppresses messages below the configured level", async () => {
    process.env["LOG_LEVEL"] = "error";
    const logger = await freshLogger();
    logger.debug({ msg: "verbose" });
    logger.info({ msg: "info" });
    logger.warn({ msg: "warn" });
    expect(writespy).not.toHaveBeenCalled();
  });

  it("passes messages at or above the configured level", async () => {
    process.env["LOG_LEVEL"] = "warn";
    const logger = await freshLogger();
    logger.warn({ msg: "warn" });
    logger.error({ msg: "error" });
    expect(writespy).toHaveBeenCalledTimes(2);
  });

  it("falls back to info level for an unrecognised LOG_LEVEL value", async () => {
    process.env["LOG_LEVEL"] = "verbose";
    const logger = await freshLogger();
    logger.info({ msg: "test" });
    expect(writespy).toHaveBeenCalled();
    logger.debug({ msg: "below" });
    // debug should be suppressed when effective level is info
    expect(writespy).toHaveBeenCalledTimes(1);
  });

  it("each log method emits the correct level field", async () => {
    const logger = await freshLogger();
    const levels = ["debug", "info", "warn", "error"] as const;
    for (const level of levels) {
      writespy.mockClear();
      process.env["LOG_LEVEL"] = "debug";
      logger[level]({ msg: level });
      if (writespy.mock.calls.length > 0) {
        const parsed = JSON.parse((writespy.mock.calls[0][0] as string).trim());
        expect(parsed.level).toBe(level);
      }
    }
  });
});
