# Testing Standards

This organisation uses **Vitest** as the test runner. Use `vi.fn()`, `vi.mock()`, and `vi.spyOn()` — not their Jest equivalents. Do not install or reference Jest.

How to write, name, and organise tests across all TypeScript projects.

## File location and naming

Place test files in a `__tests__/` directory alongside the module they test:

```
src/
  tools/
    repositories.ts
    __tests__/
      repositories.test.ts
```

Test file name = source file name + `.test.ts`. One test file per source module.

## Test structure

Use `describe` / `it` blocks. `describe` names the unit under test; `it` names the behaviour:

```ts
describe("getReleaseStatus", () => {
  it("returns null body_summary when release has no body", async () => { ... });
  it("truncates body_summary to 500 characters", async () => { ... });
});
```

`it` descriptions read as a complete sentence. Avoid "should" — it adds noise without meaning.

## What to test

**Test these:**
- Public exports only — functions and their observable return values
- Edge cases: nulls, empty arrays, missing optional fields, boundary values
- Error paths: what happens when a dependency throws or returns unexpected data
- Behaviour under different input combinations that produce different outputs

**Do not test these:**
- Private helpers that are not exported
- Framework internals (Octokit response parsing, MCP SDK routing)
- That a mock was called with arguments you set up — only assert on what callers observe

## Mocking

Inject dependencies rather than importing them directly. This keeps mocks simple:

```ts
function mockOctokit(overrides: Record<string, unknown> = {}): Octokit {
  return {
    rest: {
      repos: { getLatestRelease: vi.fn() },
      ...overrides,
    },
  } as unknown as Octokit;
}
```

Use `vi.fn()` from Vitest. Cast with `as unknown as SomeType` when the partial mock satisfies TypeScript structurally but not nominally.

Set mock return values per test, not per file — this makes each test self-contained:

```ts
it("handles a missing release", async () => {
  const octokit = mockOctokit();
  (octokit.rest.repos.getLatestRelease as ReturnType<typeof vi.fn>)
    .mockRejectedValue(new Error("Not Found"));
  ...
});
```

## Coverage expectations

- All new modules must have tests before a PR is opened
- Aim for behaviour coverage, not line coverage — a test that passes trivially provides no value
- Tests should be able to catch a regression if the implementation is deleted and rewritten naively
- Integration tests (hitting real APIs or databases) belong in a separate suite and must be skippable for local fast runs
