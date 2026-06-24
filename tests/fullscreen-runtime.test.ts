import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserTrialFullscreenAdapter,
  enterTrialFullscreen,
  exitTrialFullscreen,
  resetTrialFullscreenAdapter,
  setTrialFullscreenAdapter,
} from "../src/runtime/fullscreen";

describe("trial fullscreen runtime adapter", () => {
  afterEach(() => {
    resetTrialFullscreenAdapter();
    vi.unstubAllGlobals();
  });

  it("delegates fullscreen calls to the configured adapter", async () => {
    const enterTrialFullscreenSpy = vi.fn().mockResolvedValue(undefined);
    const exitTrialFullscreenSpy = vi.fn();
    const restoreAdapter = setTrialFullscreenAdapter({
      enterTrialFullscreen: enterTrialFullscreenSpy,
      exitTrialFullscreen: exitTrialFullscreenSpy,
    });

    await enterTrialFullscreen();
    exitTrialFullscreen();
    restoreAdapter();

    expect(enterTrialFullscreenSpy).toHaveBeenCalledTimes(1);
    expect(exitTrialFullscreenSpy).toHaveBeenCalledTimes(1);
  });

  it("uses the browser Fullscreen API when it is available", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    const fullscreenDocument = {
      fullscreenElement: null as Element | null,
      documentElement: {
        requestFullscreen,
      },
      exitFullscreen,
    };

    vi.stubGlobal("document", fullscreenDocument);

    await browserTrialFullscreenAdapter.enterTrialFullscreen();
    fullscreenDocument.fullscreenElement = {} as Element;
    browserTrialFullscreenAdapter.exitTrialFullscreen();

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("no-ops when no document is available", async () => {
    vi.stubGlobal("document", undefined);

    await expect(
      browserTrialFullscreenAdapter.enterTrialFullscreen()
    ).resolves.toBeUndefined();
    expect(() =>
      browserTrialFullscreenAdapter.exitTrialFullscreen()
    ).not.toThrow();
  });
});
