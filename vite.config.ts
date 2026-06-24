import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const tauriDevHost = process.env.TAURI_DEV_HOST;
const localeModuleId = "virtual:opjrd-locales";
const resolvedLocaleModuleId = `\0${localeModuleId}`;
const localeDirectory = fileURLToPath(
  new URL("./public/locales/", import.meta.url)
);

function opjrdLocaleManifestPlugin(): Plugin {
  return {
    name: "opjrd-locale-manifest",
    resolveId(id) {
      return id === localeModuleId ? resolvedLocaleModuleId : null;
    },
    load(id) {
      if (id !== resolvedLocaleModuleId) {
        return null;
      }

      const availableLocales = readdirSync(localeDirectory, {
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name.replace(/\.json$/u, ""))
        .sort((a, b) => a.localeCompare(b));

      return `export const availableLocales = ${JSON.stringify(availableLocales)};`;
    },
  };
}

export default defineConfig({
  base: "./",
  clearScreen: false,
  plugins: [opjrdLocaleManifestPlugin()],
  build: {
    target: "es2022",
  },
  server: {
    host: tauriDevHost ?? "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
