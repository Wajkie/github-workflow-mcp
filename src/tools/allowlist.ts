export function isRepoAllowed(repo: string, allowedRepos: string): boolean {
  if (allowedRepos === "*") return true;
  return allowedRepos
    .split(",")
    .map((r) => r.trim())
    .includes(repo);
}

export function denied(repo: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: "Repository not allowed", repo }),
      },
    ],
    isError: true as const,
  };
}
