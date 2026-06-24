import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  setTrialFullscreenAdapter,
  type TrialFullscreenAdapter,
} from "./fullscreen";

function createTauriTrialFullscreenAdapter(): TrialFullscreenAdapter {
  const currentWindow = getCurrentWindow();

  return {
    async enterTrialFullscreen(): Promise<void> {
      await currentWindow.setFullscreen(true).catch(() => undefined);
    },

    async exitTrialFullscreen(): Promise<void> {
      await currentWindow.setFullscreen(false).catch(() => undefined);
    },
  };
}

export function installTauriFullscreenAdapter(): boolean {
  if (!isTauri()) {
    return false;
  }

  setTrialFullscreenAdapter(createTauriTrialFullscreenAdapter());
  return true;
}
