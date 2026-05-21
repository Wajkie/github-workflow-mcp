# Engineering Conventions

Universal rules that apply to every TypeScript project in this organisation,
regardless of framework or runtime.

## Naming Conventions

| What | Case | Examples |
|---|---|---|
| Folders | camelCase (start lowercase) | `services/`, `exampleFolder/` |
| Files (non-component) | camelCase | `squareService.ts`, `formatDate.ts` |
| Type aliases, interfaces, enums (name only) | PascalCase | `type UserRecord`, `enum Status` |
| Functions | camelCase | `handleClick`, `formatDate` |
| Parameters | camelCase; leading `_` allowed for unused | `_req`, `userId` |
| Module-level constants | UPPER_CASE acceptable | `UNSAFE_PATH`, `BASE_URL` |

## File Standards

- Keep files under **200 lines** (non-blank, non-comment) where possible.
- One concern per file — separate different responsibilities into their own modules.

## Imports

- Use `import type` for type-only imports: `import type { Octokit } from "@octokit/rest"`
- No barrel files (`index.ts` that re-exports everything from a directory) — import directly from the source module
- Import ordering: external packages first, then internal modules, then types. Keep each group together; do not interleave.

## TypeScript

- Prefer `type` aliases over `interface` for object shapes.
- Do not use `any`. Use `unknown` and narrow explicitly.
- Avoid re-exporting types or values that nothing outside the module uses.
