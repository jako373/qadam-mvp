import js from "@eslint/js";

export default [
  {
    ignores: ["dist/**", "outputs/**", "work/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        location: "readonly",
        history: "readonly",
        FormData: "readonly",
      },
    },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.test.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        globalThis: "readonly",
      },
    },
  },
];
