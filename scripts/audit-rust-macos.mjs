import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const macosTargets = ["aarch64-apple-darwin", "x86_64-apple-darwin"];
const glibAdvisory = "RUSTSEC-2024-0429";

function runCargo(args, inheritOutput = false) {
  const result = spawnSync("cargo", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: inheritOutput ? "inherit" : ["ignore", "pipe", "inherit"],
    timeout: 600_000,
  });

  if (result.error) {
    throw new Error(`Could not run cargo ${args[0]}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `cargo ${args[0]} failed (${result.signal ?? `exit ${result.status}`}).`
    );
  }
  return result.stdout?.trim() ?? "";
}

export function auditMacosRustDependencies() {
  // The one advisory exception is valid only while glib is absent on both targets.
  for (const target of macosTargets) {
    const graph = runCargo([
      "tree",
      "--manifest-path", "src-tauri/Cargo.toml",
      "--locked",
      "--target", target,
      "--features", "tauri/custom-protocol",
      "--invert", "glib",
    ]);
    if (graph) {
      throw new Error(
        `glib is selected for ${target}; reassess ${glibAdvisory} before allowing the audit exception.`
      );
    }
  }

  process.stderr.write(
    `Known limitation: ${glibAdvisory} remains in the Linux desktop dependency graph. ` +
    "glib is absent from both macOS targets. This check does not approve Linux desktop releases. " +
    "See docs/dependencies.md.\n"
  );
  runCargo([
    "audit",
    "--file", "src-tauri/Cargo.lock",
    "--deny", "unsound",
    "--deny", "yanked",
    "--ignore", glibAdvisory,
  ], true);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    auditMacosRustDependencies();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
