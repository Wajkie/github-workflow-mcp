export function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function toErrorContent(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const e = error as {
      status: number;
      message?: string;
      response?: { headers?: Record<string, string> };
    };
    const remaining = e.response?.headers?.["x-ratelimit-remaining"];
    const reset = e.response?.headers?.["x-ratelimit-reset"];
    if ((e.status === 403 || e.status === 429) && remaining === "0") {
      const resetDate = reset ? new Date(Number(reset) * 1000).toISOString() : "unknown";
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { error: "GitHub rate limit exceeded", ratelimit_reset: resetDate },
              null,
              2,
            ),
          },
        ],
      };
    }
    const message = e.message ?? String(e.status);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: message }, null, 2) }],
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }, null, 2) }] };
}
