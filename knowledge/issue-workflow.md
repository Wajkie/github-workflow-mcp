# Issue Workflow

How to take an issue from open to closed. Applies to all projects in this organisation.

## Before you start

Read the issue in full before touching code. Understand:
- What problem it solves, not just what it says to implement
- Which files are likely affected
- Whether it depends on other open issues

Load relevant knowledge files before implementing:
- Always: `conventions.md`
- React projects: `reactConventions.md`
- Designing features or reviewing large changes: `architecture.md`
- Uncertain about patterns: `examples.md`

## Branching

Before creating a branch, ask which branch to base the work on. Do not assume `main` — the project may use a different default branch, a long-lived development branch, or a release branch. If it is not clear from context, ask explicitly before proceeding.

Name the branch:

```
<type>/<issue-number>-short-description
```

Types match conventional commit types:

| Type | Use for |
|---|---|
| `feature` | New functionality |
| `fix` | Bug fixes |
| `refactor` | Internal restructuring, no behaviour change |
| `chore` | Tooling, dependencies, config |
| `docs` | Documentation only |

Examples:
```
feature/42-search-endpoint
fix/17-null-patch-handling
chore/8-update-dependencies
```

One branch per issue. Do not bundle unrelated changes onto the same branch.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body — use when the WHY is not obvious from the subject line]
```

- Subject line: imperative mood, lowercase, no trailing period, 72 chars max
- Scope: the module or domain affected (`tools`, `auth`, `db`, `server`)
- Body: explain *why*, not *what* — the diff already shows what changed

Examples:
```
feat(tools): add get_release_status and get_recent_deployments

fix(allowlist): treat wildcard as allow-all when ALLOWED_REPOS is unset

chore(deps): upgrade @octokit/rest to 21.x
```

Breaking changes: add `!` after the type (`feat!:`) or include a `BREAKING CHANGE:` footer.

## Definition of done

Before opening a PR:

- [ ] `npm test` — all tests pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run lint` — no lint violations
- [ ] New behaviour is covered by tests (see `testing.md`)
- [ ] No debug code, commented-out blocks, or leftover TODOs

## Opening a PR

**Title:** same format as a commit subject — `feat(scope): description`

**Body must include:**
- 2–3 sentences on what changed and why
- `Closes #<issue-number>` to auto-close the issue on merge
- Manual testing steps if the change affects a UI or external-facing behaviour

Keep PRs small. If a PR is hard to review in one sitting, split the issue.

## After merge

Verify the issue is closed (the `Closes #n` keyword handles this automatically).
Delete the feature branch.
