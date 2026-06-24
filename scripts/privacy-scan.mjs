import { readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, statSync } from "node:fs";

const root = fileURLToPath(new URL("..", import.meta.url));
const ignoredDirs = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "target",
]);
const checkedExtensions = new Set([
  ".cff",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const patterns = [
  {
    name: "absolute local user path",
    regex: /\/Users\/[A-Za-z0-9._-]+/u,
  },
  {
    name: "Windows user path",
    regex: /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/u,
  },
  {
    name: "private environment assignment",
    regex: /(?:API|TOKEN|SECRET|PASSWORD|KEY)=\S+/iu,
  },
];

function listFiles(dir) {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const path = `${dir}/${entry}`;
    const stats = statSync(path);
    if (stats.isDirectory()) {
      return ignoredDirs.has(entry) ? [] : listFiles(path);
    }
    return stats.isFile() ? [path] : [];
  });
}

let failed = false;

for (const path of listFiles(root)) {
  if (!checkedExtensions.has(extname(path))) {
    continue;
  }

  const text = await readFile(path, "utf8");
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      console.error(
        `Privacy scan failed: ${pattern.name} found in ${relative(root, path)}`
      );
      failed = true;
    }
  }
}

if (failed) {
  process.exitCode = 1;
}
