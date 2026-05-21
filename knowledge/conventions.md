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

## TypeScript

- Prefer `type` aliases over `interface` for object shapes.
- Do not use `any`. Use `unknown` and narrow explicitly.
- Avoid re-exporting types or values that nothing outside the module uses.
