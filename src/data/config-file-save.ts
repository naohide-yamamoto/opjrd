import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

const CONFIG_SAVE_DIALOG_TITLE = "Save OPJRD config";
const CONFIG_DOWNLOAD_FILENAME = "opjrd-config.json";

export function configSaveFilename(pathOrFilename: string): string {
  return (
    pathOrFilename.split(/[\\/]/u).filter(Boolean).at(-1) ||
    CONFIG_DOWNLOAD_FILENAME
  );
}

function downloadConfig(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 30_000);
}

export async function saveConfigText(
  text: string,
  defaultFilename = "config.json"
): Promise<boolean> {
  if (isTauri()) {
    const selectedPath = await save({
      title: CONFIG_SAVE_DIALOG_TITLE,
      defaultPath: configSaveFilename(defaultFilename),
      canCreateDirectories: true,
      filters: [
        {
          name: "JSON config",
          extensions: ["json"],
        },
      ],
    });

    if (selectedPath === null) {
      return false;
    }

    await writeTextFile(selectedPath, text);
    return true;
  }

  downloadConfig(defaultFilename || CONFIG_DOWNLOAD_FILENAME, text);
  return true;
}
