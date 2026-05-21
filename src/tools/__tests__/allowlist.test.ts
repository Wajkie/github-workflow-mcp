import { describe, expect, it } from "vitest";
import { denied, isRepoAllowed } from "../allowlist.js";

describe("isRepoAllowed", () => {
  it("permits all repos when allowedRepos is *", () => {
    expect(isRepoAllowed("any-repo", "*")).toBe(true);
    expect(isRepoAllowed("another-repo", "*")).toBe(true);
  });

  it("permits a repo that is on the allowlist", () => {
    expect(isRepoAllowed("frontend", "frontend,backend")).toBe(true);
    expect(isRepoAllowed("backend", "frontend,backend")).toBe(true);
  });

  it("denies a repo not on the allowlist", () => {
    expect(isRepoAllowed("secret-repo", "frontend,backend")).toBe(false);
  });

  it("handles single-entry allowlist", () => {
    expect(isRepoAllowed("only-repo", "only-repo")).toBe(true);
    expect(isRepoAllowed("other-repo", "only-repo")).toBe(false);
  });

  it("trims whitespace from allowlist entries", () => {
    expect(isRepoAllowed("frontend", "frontend, backend")).toBe(true);
    expect(isRepoAllowed("backend", "frontend, backend")).toBe(true);
  });
});

describe("denied", () => {
  it("returns isError true", () => {
    const result = denied("secret-repo");
    expect(result.isError).toBe(true);
  });

  it("includes the repo name and error message in the response", () => {
    const result = denied("secret-repo");
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe("Repository not allowed");
    expect(body.repo).toBe("secret-repo");
  });
});
