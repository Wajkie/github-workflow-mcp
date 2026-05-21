# Code Review Checklist

Work top-down. Correctness failures block everything else.

## Correctness

- [ ] Implementation matches the issue's acceptance criteria exactly
- [ ] Edge cases handled: empty inputs, nulls, missing optional fields, boundary values
- [ ] Error paths tested, not just the happy path
- [ ] No logic errors: off-by-one, wrong operator, incorrect condition

## Tests

- [ ] New behaviour has test coverage
- [ ] Tests assert behaviour, not implementation details — they would catch a regression if the code were deleted and rewritten
- [ ] No test that only passes because a mock returns exactly what the function happens to return
- [ ] See `testing.md` for structure and naming expectations

## Security

- [ ] No secrets, tokens, or credentials appear in tool output or logs
- [ ] No arbitrary shell execution or unrestricted filesystem access
- [ ] Input validated at system boundaries (repo names, file paths, query strings)
- [ ] No SQL injection vectors — parameterised queries only
- [ ] Repository allowlist enforced for any tool that accesses a specific repo

## TypeScript

- [ ] No `any` — use `unknown` and narrow explicitly
- [ ] Return types are explicit where inference is not obvious
- [ ] `tsc --noEmit` passes clean — no suppressions

## Conventions

- [ ] Naming follows `conventions.md` (and `reactConventions.md` for frontend)
- [ ] Files stay under 200 lines
- [ ] One concern per file — no unrelated code bundled in
- [ ] No re-exports of things nothing outside the module uses

## Performance

- [ ] No N+1 API calls in loops
- [ ] Lists are capped or paginated — no unbounded result sets
- [ ] No synchronous I/O on the request path

## PR hygiene

- [ ] PR description explains *why*, not just *what*
- [ ] Issue is linked (`Closes #n`)
- [ ] No debug code, `console.log`, or commented-out blocks
- [ ] No TODO comments that were not in the original issue
