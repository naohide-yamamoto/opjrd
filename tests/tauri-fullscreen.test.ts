import { afterEach, describe, expect, it, vi } from "vitest";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  enterTrialFullscreen,
  exitTrialFullscreen,
  resetTrialFullscreenAdapter,
} from "../src/runtime/fullscreen";
import { installTauriFullscreenAdapter } from "../src/runtime/tauri-fullscreen";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(),
}));

describe("Tauri fullscreen runtime adapter", () => {
  afterEach(() => {
    resetTrialFullscreenAdapter();
    vi.mocked(isTauri).mockReset();
    vi.mocked(getCurrentWindow).mockReset();
  });

  it("does not replace the browser adapter outside Tauri", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    expect(installTauriFullscreenAdapter()).toBe(false);
    expect(getCurrentWindow).not.toHaveBeenCalled();
  });

  it("uses Tauri window fullscreen when running inside Tauri", async () => {
    const setFullscreen = vi.fn().mockResolvedValue(undefined);

    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(getCurrentWindow).mockReturnValue({
      setFullscreen,
    } as unknown as ReturnType<typeof getCurrentWindow>);

    expect(installTauriFullscreenAdapter()).toBe(true);

    await enterTrialFullscreen();
    exitTrialFullscreen();

    expect(setFullscreen).toHaveBeenNthCalledWith(1, true);
    expect(setFullscreen).toHaveBeenNthCalledWith(2, false);
  });
});
