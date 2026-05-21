# React Conventions

Rules specific to React / Vite frontend projects. Read alongside `conventions.md`,
which covers the universal TypeScript rules that also apply here.

## Naming

| What | Case | Examples |
|---|---|---|
| Component files | PascalCase | `MyButton.tsx` |
| CSS module files | PascalCase, matching component exactly | `MyButton.module.css` |
| Hook files and names | camelCase, must start with `use` | `useScrollToTop.ts` |
| CSS class names | camelCase | `.container`, `.primaryButton` |

## Components

- Name components in PascalCase; names should be self-descriptive.
- Each component lives in its own folder alongside its CSS module:
  ```
  primaryButton/
    PrimaryButton.tsx
    PrimaryButton.module.css
  ```
- Type props with a `type` alias, never `interface`:
  ```ts
  type MyProps = {
    label: string;
    count: number;
  };
  ```

## Hooks

- Hook names must start with `use` and be self-descriptive.
- Data hooks (those that call an API) go under `hooks/data/<domain>/`.
- Utility hooks (UI behaviour, no data fetching) go under `hooks/utils/`.

## Folder Structure

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
  services/               # API / service logic, one folder per domain
    squareApi/
      squareApi.ts
      partials/
        getAllSquares.ts
        insertSquare.ts
  App.tsx
  main.tsx
```

Config files (`tsconfig.app.json`, `eslint.config.js`, `package.json`, etc.) live
at the project root alongside `index.html` and `.env.example`.
