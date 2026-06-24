import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { SaveAdapter, SaveBundle } from "./save-adapters";

const SAVE_DIRECTORY_DIALOG_TITLE = "Choose where to save OPJRD data";

export class TauriSaveCancelledError extends Error {
  constructor() {
    super("Tauri save was cancelled.");
    this.name = "TauriSaveCancelledError";
  }
}

export function joinTauriSavePath(directoryPath: string, filename: string): string {
  const separator =
    directoryPath.includes("\\") && !directoryPath.includes("/") ? "\\" : "/";
  return `${directoryPath.replace(/[\\/]+$/u, "")}${separator}${filename}`;
}

export const tauriSaveAdapter: SaveAdapter = {
  name: "tauri",
  isAvailable: () => isTauri(),
  save: async (bundle: SaveBundle) => {
    const directoryPath = await open({
      title: SAVE_DIRECTORY_DIALOG_TITLE,
      directory: true,
      multiple: false,
      canCreateDirectories: true,
    });

    if (directoryPath === null) {
      throw new TauriSaveCancelledError();
    }
    if (Array.isArray(directoryPath)) {
      throw new Error("Tauri save expected one output directory.");
    }

    await writeTextFile(
      joinTauriSavePath(directoryPath, bundle.json.filename),
      JSON.stringify(bundle.json.session, null, 2)
    );
    if (bundle.csv) {
      await writeTextFile(
        joinTauriSavePath(directoryPath, bundle.csv.filename),
        bundle.csv.text
      );
    }
  },
};
