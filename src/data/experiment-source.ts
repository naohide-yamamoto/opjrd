import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  createEditableConfigDraft,
  normaliseExperimentConfig,
} from "../core/config";
import {
  createBrowserExperimentFileLoader,
  type ExperimentFileLoader,
  resolveRelativeUrl,
} from "../core/experiment";
import type { ExperimentConfig } from "../core/types";
import {
  asRecord,
  getJatosComponentInput,
  getJatosStudyInput,
  isJatosRuntimeAvailable,
} from "../runtime/jatos";

export interface ExperimentSource {
  config: ExperimentConfig;
  configPath: string;
  fileLoader: ExperimentFileLoader;
  localConfigFolderPath?: string;
  localConfigPath?: string;
  sourceLabel?: string;
}

export interface TauriStimulusImageSelection {
  relativePath: string;
}

const CONFIG_DIALOG_TITLE = "Choose OPJRD experiment config";
const CONFIG_FOLDER_DIALOG_TITLE = "Choose OPJRD experiment config folder";

export function shouldUseTauriLocalConfig(search: string): boolean {
  return isTauri() && !new URLSearchParams(search).has("config");
}

export async function loadBrowserExperimentSource(
  configUrl: string
): Promise<ExperimentSource> {
  const response = await fetch(configUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load config: ${configUrl} (${response.status}).`);
  }

  return {
    config: normaliseExperimentConfig(await response.json()),
    configPath: configUrl,
    fileLoader: createBrowserExperimentFileLoader(configUrl),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readJatosConfigInput(): Record<string, unknown> {
  return {
    ...(getJatosStudyInput() ?? {}),
    ...(getJatosComponentInput() ?? {}),
  };
}

export async function loadJatosExperimentSource(
  fallbackConfigUrl: string
): Promise<ExperimentSource> {
  if (!isJatosRuntimeAvailable()) {
    throw new Error("JATOS config loading was requested, but JATOS is unavailable.");
  }

  const input = readJatosConfigInput();
  const configPath = stringValue(input.configPath);
  const embeddedConfig = asRecord(input.config);

  if (embeddedConfig) {
    const baseUrl = configPath
      ? resolveRelativeUrl(configPath, window.location.href)
      : window.location.href;
    return {
      config: normaliseExperimentConfig(embeddedConfig),
      configPath: configPath
        ? `jatos:${configPath}`
        : "jatos:componentInput.config",
      fileLoader: createBrowserExperimentFileLoader(baseUrl),
      sourceLabel: configPath
        ? `JATOS config: ${configPath}`
        : "JATOS component input config",
    };
  }

  if (configPath) {
    const source = await loadBrowserExperimentSource(
      resolveRelativeUrl(configPath, window.location.href)
    );
    return {
      ...source,
      configPath: `jatos:${configPath}`,
      sourceLabel: `JATOS config: ${configPath}`,
    };
  }

  return loadBrowserExperimentSource(fallbackConfigUrl);
}

export async function chooseTauriConfigPath(): Promise<string | null> {
  const selectedPath = await open({
    title: CONFIG_DIALOG_TITLE,
    directory: false,
    multiple: false,
    filters: [
      {
        name: "JSON config",
        extensions: ["json"],
      },
    ],
  });

  if (selectedPath === null) {
    return null;
  }
  if (Array.isArray(selectedPath)) {
    throw new Error("OPJRD expected one config file.");
  }
  return selectedPath;
}

export async function chooseTauriConfigFolderPath(): Promise<string | null> {
  const selectedPath = await open({
    title: CONFIG_FOLDER_DIALOG_TITLE,
    directory: true,
    multiple: false,
    canCreateDirectories: true,
  });

  if (selectedPath === null) {
    return null;
  }
  if (Array.isArray(selectedPath)) {
    throw new Error("OPJRD expected one experiment config folder.");
  }
  return selectedPath;
}

export async function loadTauriExperimentSource(
  configPath: string
): Promise<ExperimentSource> {
  const rawConfig = await readTauriExperimentTextFile(configPath, null);

  return createTauriExperimentSource(
    configPath,
    normaliseExperimentConfig(JSON.parse(rawConfig))
  );
}

export async function loadTauriExperimentSourceForEditing(
  configPath: string
): Promise<ExperimentSource> {
  const rawConfig = await readTauriExperimentTextFile(configPath, null);

  return createTauriExperimentSource(
    configPath,
    createEditableConfigDraft(JSON.parse(rawConfig))
  );
}

function createTauriExperimentSource(
  configPath: string,
  config: ExperimentConfig
): ExperimentSource {
  return {
    config,
    configPath: localConfigDisplayPath(configPath),
    fileLoader: {
      loadAssetUrl: (path: string) =>
        readTauriExperimentAssetFile(configPath, path).catch(() => {
          throw new Error(`Could not load stimulus image: ${path}.`);
        }),
      loadTextFile: (path: string) =>
        readTauriExperimentTextFile(configPath, path),
    },
    localConfigPath: configPath,
    sourceLabel: localConfigEditorLabel(configPath),
  };
}

export function localConfigDisplayPath(configPath: string): string {
  const filename = configPath.split(/[\\/]/u).filter(Boolean).at(-1);
  return `tauri-local:${filename || "config.json"}`;
}

export function localConfigFolderDisplayPath(folderPath: string): string {
  const folderName = folderPath.split(/[\\/]/u).filter(Boolean).at(-1);
  return `tauri-local-folder:${folderName || "selected-folder"}/config.json`;
}

function localPathTail(path: string, fallbackFilename: string): string {
  const parts = path.split(/[\\/]/u).filter(Boolean);
  const filename = parts.at(-1) ?? fallbackFilename;
  const folderName = parts.at(-2);

  return folderName ? `${folderName}/${filename}` : filename;
}

export function localConfigEditorLabel(configPath: string): string {
  return `Experiment config: ${localPathTail(configPath, "config.json")}`;
}

export function localConfigFolderEditorLabel(folderPath: string): string {
  const folderName =
    folderPath.split(/[\\/]/u).filter(Boolean).at(-1) ?? "selected folder";
  return `Experiment config: ${folderName}/config.json`;
}

async function readTauriExperimentTextFile(
  configPath: string,
  relativePath: string | null
): Promise<string> {
  return invoke<string>("read_experiment_text_file", {
    configPath,
    relativePath,
  });
}

async function readTauriExperimentAssetFile(
  configPath: string,
  relativePath: string
): Promise<string> {
  return invoke<string>("read_experiment_asset_file", {
    configPath,
    relativePath,
  });
}

export async function chooseTauriStimulusImage(
  configPath: string
): Promise<TauriStimulusImageSelection | null> {
  return chooseTauriStimulusImageWithCommand(
    "relative_experiment_file_path",
    "configPath",
    configPath
  );
}

export async function chooseTauriStimulusImageInFolder(
  folderPath: string
): Promise<TauriStimulusImageSelection | null> {
  return chooseTauriStimulusImageWithCommand(
    "relative_experiment_folder_file_path",
    "folderPath",
    folderPath
  );
}

async function chooseTauriStimulusImageWithCommand(
  command: string,
  baseKey: "configPath" | "folderPath",
  basePath: string
): Promise<TauriStimulusImageSelection | null> {
  const selectedPath = await open({
    title: "Choose object image",
    directory: false,
    multiple: false,
    filters: [
      {
        name: "Images",
        extensions: ["svg", "png", "jpg", "jpeg", "webp", "gif", "bmp"],
      },
    ],
  });

  if (selectedPath === null) {
    return null;
  }
  if (Array.isArray(selectedPath)) {
    throw new Error("OPJRD expected one image file.");
  }

  const relativePath = await invoke<string>(command, {
    [baseKey]: basePath,
    filePath: selectedPath,
  });

  return {
    relativePath,
  };
}

export async function validateTauriStimulusImagePath(
  configPath: string,
  relativePath: string
): Promise<void> {
  await invoke<void>("validate_experiment_asset_file", {
    configPath,
    relativePath,
  });
}

export async function validateTauriExperimentDataFilePath(
  configPath: string,
  relativePath: string
): Promise<void> {
  await invoke<void>("validate_experiment_data_file", {
    configPath,
    relativePath,
  });
}

export async function validateTauriStimulusImagePathInFolder(
  folderPath: string,
  relativePath: string
): Promise<void> {
  await invoke<void>("validate_experiment_folder_asset_file", {
    folderPath,
    relativePath,
  });
}

export async function validateTauriExperimentDataFilePathInFolder(
  folderPath: string,
  relativePath: string
): Promise<void> {
  await invoke<void>("validate_experiment_folder_data_file", {
    folderPath,
    relativePath,
  });
}
