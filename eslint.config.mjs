import nextPlugin from "@next/eslint-plugin-next";

const nextRecommended = nextPlugin.configs.recommended;
const nextCoreWeb = nextPlugin.configs["core-web-vitals"];

export default [
  {
    ignores: ["**/node_modules/**", ".next/**"],
  },
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextRecommended.rules,
      ...nextCoreWeb.rules,
    },
    languageOptions: {
      ...nextRecommended.languageOptions,
      ...nextCoreWeb.languageOptions,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        ...nextRecommended.languageOptions?.parserOptions,
        ...nextCoreWeb.languageOptions?.parserOptions,
      },
    },
    linterOptions: {
      ...nextRecommended.linterOptions,
      ...nextCoreWeb.linterOptions,
    },
    settings: {
      ...nextRecommended.settings,
      ...nextCoreWeb.settings,
      next: { rootDir: ["./"] },
    },
  },
];
