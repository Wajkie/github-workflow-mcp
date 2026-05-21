# Release Process

How releases are versioned, cut, and deployed.

## Versioning

This organisation uses [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

| Change | Bump |
|---|---|
| Breaking change to a public API or tool contract | MAJOR |
| New feature, backwards-compatible | MINOR |
| Bug fix, no new functionality | PATCH |
| Internal refactor, tooling, docs | No bump |

When in doubt, prefer MINOR over PATCH. Never bump MAJOR for internal refactors.

## Conventional commits → version

Commit types map directly to version bumps:

| Commit type | Version bump |
|---|---|
| `feat:` | MINOR |
| `fix:` | PATCH |
| `feat!:` or `BREAKING CHANGE:` footer | MAJOR |
| `chore:`, `refactor:`, `docs:`, `test:`, `perf:` | None |

## Branching strategy

All work happens on feature branches cut from `main`. `main` is always releasable.

```
main  ──●──────────────────────────●── (tagged release)
         \                        /
          feature/42-new-thing ──●
```

Never commit directly to `main`. Merge via PR after review.

## Release checklist

Before tagging:

- [ ] All issues in the release milestone are closed
- [ ] `npm test` passes with no failures
- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run lint` is clean
- [ ] `package.json` version field updated
- [ ] CHANGELOG updated (or auto-generated from commits)
- [ ] No debug code or temporary flags left enabled

## Tagging

```bash
git tag -a v<version> -m "Release v<version>"
git push origin v<version>
```

Tag on `main` after the release branch or last feature branch is merged.

## Deployment

This project deploys via Docker + Railway:

1. Pushing a tag triggers a Docker build via CI
2. Railway pulls the new image on tag push
3. After deploy, verify `GET /health` returns `{ "status": "ok" }` with HTTP 200
4. Check structured logs (stderr) for startup errors before marking the deploy complete

Environment variables must be set in Railway before deploying — see `.env.example` for the full list.

## Rollback

Railway supports instant rollback to the previous deployed image via the dashboard. Use this for production incidents. Do not attempt a hotfix deploy under pressure unless the fix is trivial, already tested locally, and the root cause is understood.
