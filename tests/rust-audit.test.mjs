import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditMacosRustDependencies } from "../scripts/audit-rust-macos.mjs";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

describe("macOS Rust dependency audit", () => {
  beforeEach(() => {
    vi.mocked(spawnSync).mockReset().mockReturnValue({ status: 0, stdout: "" });
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("checks both locked macOS graphs before applying the one advisory exception", () => {
    auditMacosRustDependencies();

    const calls = vi.mocked(spawnSync).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0][1]).toEqual([
      "tree", "--manifest-path", "src-tauri/Cargo.toml", "--locked",
      "--target", "aarch64-apple-darwin", "--features", "tauri/custom-protocol",
      "--invert", "glib",
    ]);
    expect(calls[1][1]).toEqual([
      "tree", "--manifest-path", "src-tauri/Cargo.toml", "--locked",
      "--target", "x86_64-apple-darwin", "--features", "tauri/custom-protocol",
      "--invert", "glib",
    ]);
    expect(calls[2][1]).toEqual([
      "audit", "--file", "src-tauri/Cargo.lock", "--deny", "unsound",
      "--deny", "yanked", "--ignore", "RUSTSEC-2024-0429",
    ]);
    expect(calls[2][2].stdio).toBe("inherit");
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("does not approve Linux desktop releases")
    );
  });

  it.each([0, 1])("rejects glib appearing in macOS graph %i", (graphIndex) => {
    if (graphIndex === 1) {
      vi.mocked(spawnSync).mockReturnValueOnce({ status: 0, stdout: "" });
    }
    vi.mocked(spawnSync).mockReturnValueOnce({ status: 0, stdout: "glib v0.18.5\n" });

    expect(auditMacosRustDependencies).toThrow("reassess RUSTSEC-2024-0429");
    expect(spawnSync).toHaveBeenCalledTimes(graphIndex + 1);
  });

  it("fails closed when a graph cannot be resolved, including a stale glib exception", () => {
    vi.mocked(spawnSync).mockReturnValueOnce({ status: 101, stdout: "" });

    expect(auditMacosRustDependencies).toThrow("cargo tree failed (exit 101)");
    expect(spawnSync).toHaveBeenCalledTimes(1);
  });

  it("does not treat a missing Cargo executable as a clean graph", () => {
    vi.mocked(spawnSync).mockReturnValueOnce({ error: new Error("spawn cargo ENOENT") });

    expect(auditMacosRustDependencies).toThrow("Could not run cargo tree");
    expect(spawnSync).toHaveBeenCalledTimes(1);
  });

  it("does not treat a terminated command as success", () => {
    vi.mocked(spawnSync).mockReturnValueOnce({ status: null, signal: "SIGTERM" });

    expect(auditMacosRustDependencies).toThrow("cargo tree failed (SIGTERM)");
  });

  it.each([1, 2, 101])("propagates audit failure with exit code %i", (status) => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0, stdout: "" })
      .mockReturnValueOnce({ status: 0, stdout: "" })
      .mockReturnValueOnce({ status });

    expect(auditMacosRustDependencies).toThrow(`cargo audit failed (exit ${status})`);
  });

  it("fails if cargo-audit is not installed", () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0, stdout: "" })
      .mockReturnValueOnce({ status: 0, stdout: "" })
      .mockReturnValueOnce({ status: 101 });

    expect(auditMacosRustDependencies).toThrow("cargo audit failed");
  });
});
