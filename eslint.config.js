import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },

  tseslint.configs.recommended,

  {
    files: ["src/**/*.ts"],
    rules: {
      // Require semicolons (auto-fixable).
      semi: ["error", "always"],

      // Allow _-prefixed parameters to mark intentionally unused ones.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // PascalCase for type aliases, interfaces, and enums.
      // camelCase for everything else; UPPER_CASE allowed for module-level constants.
      // Leading underscore allowed on parameters to mark intentionally unused ones.
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "variable",
          modifiers: ["const"],
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "variable",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
      ],

      // Keep files focused — warn when a file exceeds 200 non-blank, non-comment lines.
      "max-lines": [
        "warn",
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
    },
  },
);
