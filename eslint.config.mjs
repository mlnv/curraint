import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/",
      "**/node_modules/",
      "**/test-results/",
      "**/*.d.ts",
      "scripts/",
    ],
  },
  {
    files: ["packages/*/src/**/*.ts", "packages/*/tests/**/*.ts"],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "warn",
    },
  },
  {
    files: ["**/*.mjs", "**/*.cjs"],
    rules: {
      "no-undef": "off",
    },
  },
);
