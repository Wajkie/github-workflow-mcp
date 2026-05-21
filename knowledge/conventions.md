# Engineering Conventions

## Naming Conventions

### Casing rules

| What | Case | Examples |
|---|---|---|
| Folders | camelCase (start lowercase) | `components/`, `exampleFolder/` |
| Non-component files | camelCase | `squareService.ts`, `formatDate.ts`, `useInsertSquare.ts` |
| Component files (React) | PascalCase | `MyButton.tsx` |
| CSS module files (React) | PascalCase, matching component exactly | `MyButton.module.css` |
| Type aliases, interfaces, enums (name only, not the file) | PascalCase | `type MyProps`, `interface UserRecord`, `enum Status` |
| Functions and hooks | camelCase | `handleClick`, `formatDate`, `useInsertSquare` |
| CSS class names | camelCase | `.container`, `.primaryButton` |
| Module-level constants | UPPER_CASE is acceptable | `UNSAFE_PATH`, `BASE_URL` |

### React components

- Name components in PascalCase; names should be self-descriptive.
- Each component lives in its own folder alongside its CSS module:
  ```
  primaryButton/
    PrimaryButton.tsx
    PrimaryButton.module.css
  ```
- The CSS module filename must match the component name exactly.
- Type props with a `type` alias (not `interface`):
  ```ts
  type MyProps = {
    label: string;
    count: number;
  };
  ```

### Hooks

- Hook names must start with `use` and be self-descriptive, e.g. `useScrollToTop.ts`.

## File Standards

- Keep files under **200 lines** (non-blank, non-comment) where possible.
- Separate different responsibilities into their own modules — one concern per file.

## React Project Folder Structure

```
src/
  assets/
    styles/
      variables/          # CSS variable files (colors.css, spacing.css, …)
      global.css
  components/
    ui/                   # Pure UI components (buttons, dialogs, …)
      buttons/
        primaryButton/
          PrimaryButton.tsx
          PrimaryButton.module.css
    utils/                # Shared utility functions
      formatDate.ts
    hooks/
      data/               # Data-interaction hooks, grouped by domain
        square/
          useGetSquares.ts
          useInsertSquare.ts
      utils/              # General-purpose hooks
        useScrollToTop.ts
  pages/                  # Routable page components
    homePage/
      HomePage.tsx
      HomePage.module.css
    notFoundPage/
      NotFoundPage.tsx
      NotFoundPage.module.css
  services/               # Service / API logic, one folder per service
    squareApi/
      squareApi.ts
      partials/
        getAllSquares.ts
        insertSquare.ts
  App.tsx
  main.tsx
```

Config files (`tsconfig.app.json`, `eslint.config.js`, `package.json`, etc.) live at the project root alongside `index.html` and `.env.example`.
