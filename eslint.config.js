import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["coverage/", "dist/", "node_modules/", "src-tauri/target/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        Blob: "readonly",
        URL: "readonly",
        console: "readonly",
        crypto: "readonly",
        document: "readonly",
        fetch: "readonly",
        navigator: "readonly",
        performance: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-console": ["warn", { "allow": ["warn", "error"] }],
    },
  },
];
