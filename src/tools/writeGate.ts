export function writeDenied() {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: "Write operations are disabled. Set ALLOW_WRITES=true to enable them.",
        }),
      },
    ],
    isError: true as const,
  };
}
