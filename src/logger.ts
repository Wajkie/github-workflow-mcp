type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function getConfiguredLevel(): Level {
  const raw = process.env["LOG_LEVEL"] ?? "info";
  return (raw in LEVELS ? raw : "info") as Level;
}

function write(level: Level, data: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[getConfiguredLevel()]) return;
  process.stderr.write(
    JSON.stringify({ level, timestamp: new Date().toISOString(), ...data }) + "\n"
  );
}

export const logger = {
  debug: (data: Record<string, unknown>) => write("debug", data),
  info: (data: Record<string, unknown>) => write("info", data),
  warn: (data: Record<string, unknown>) => write("warn", data),
  error: (data: Record<string, unknown>) => write("error", data),
};
