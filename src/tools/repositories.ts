import type { Octokit } from "@octokit/rest";

export async function listRepositories(octokit: Octokit, org: string) {
  let items: Awaited<ReturnType<typeof octokit.rest.repos.listForOrg>>["data"];
  try {
    const { data } = await octokit.rest.repos.listForOrg({ org, type: "all", per_page: 100 });
    items = data;
  } catch (err: unknown) {
    if ((err as { status?: number }).status !== 404) throw err;
    const { data } = await octokit.rest.repos.listForUser({ username: org, type: "all", per_page: 100 });
    items = data;
  }
  return items.map((r) => ({
    name: r.name,
    description: r.description ?? null,
    default_branch: r.default_branch,
    visibility: r.visibility ?? "private",
  }));
}

export async function getRepository(octokit: Octokit, org: string, repo: string) {
  const { data: r } = await octokit.rest.repos.get({ owner: org, repo });
  return {
    name: r.name,
    description: r.description ?? null,
    default_branch: r.default_branch,
    visibility: r.visibility ?? "private",
    language: r.language ?? null,
    topics: r.topics ?? [],
    size: r.size,
    open_issues_count: r.open_issues_count,
  };
}

const UNSAFE_PATH = /(\*|\.\.|\/\/|^\/)/;

export async function getFile(
  octokit: Octokit,
  org: string,
  repo: string,
  path: string,
  ref?: string,
) {
  if (UNSAFE_PATH.test(path)) {
    throw new Error(`Unsafe path rejected: ${path}`);
  }

  const params: { owner: string; repo: string; path: string; ref?: string } = {
    owner: org,
    repo,
    path,
  };
  if (ref) params.ref = ref;

  const { data } = await octokit.rest.repos.getContent(params);

  if (Array.isArray(data)) {
    throw new Error(`Path is a directory, not a file: ${path}`);
  }
  if (data.type !== "file") {
    throw new Error(`Expected file, got ${data.type}: ${path}`);
  }

  const content =
    data.encoding === "base64"
      ? Buffer.from(data.content, "base64").toString("utf-8")
      : data.content;

  return { path: data.path, sha: data.sha, size: data.size, content };
}

// Octokit's type for search.code doesn't expose text_matches or custom headers — cast to allow them.
export type OctokitWithTextMatch = Omit<Octokit, "rest"> & {
  rest: Omit<Octokit["rest"], "search"> & {
    search: {
      code: (params: {
        q: string;
        per_page?: number;
        headers?: Record<string, string>;
      }) => Promise<{
        data: {
          items: Array<{
            path: string;
            html_url: string;
            text_matches?: Array<{ fragment: string }>;
          }>;
        };
      }>;
    };
  };
};

export async function searchCode(
  octokit: Octokit,
  org: string,
  repo: string,
  query: string,
) {
  const { data } = await (octokit as OctokitWithTextMatch).rest.search.code({
    q: `${query} repo:${org}/${repo}`,
    per_page: 30,
    headers: { accept: "application/vnd.github.text-match+json" },
  });

  return data.items.map((item) => {
    const match = item.text_matches?.[0];
    return {
      path: item.path,
      url: item.html_url,
      snippet: match?.fragment ?? null,
    };
  });
}
