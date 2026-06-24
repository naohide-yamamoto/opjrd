import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  chooseTauriConfigFolderPath,
  chooseTauriStimulusImage,
  chooseTauriStimulusImageInFolder,
  chooseTauriConfigPath,
  loadTauriExperimentSource,
  loadTauriExperimentSourceForEditing,
  localConfigEditorLabel,
  localConfigFolderEditorLabel,
  localConfigFolderDisplayPath,
  localConfigDisplayPath,
  shouldUseTauriLocalConfig,
  validateTauriExperimentDataFilePath,
  validateTauriExperimentDataFilePathInFolder,
  validateTauriStimulusImagePath,
  validateTauriStimulusImagePathInFolder,
} from "../src/data/experiment-source";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

describe("experiment source adapters", () => {
  afterEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(isTauri).mockReset();
    vi.mocked(open).mockReset();
  });

  it("uses the Tauri config chooser only in Tauri without an explicit config URL", () => {
    vi.mocked(isTauri).mockReturnValue(false);
    expect(shouldUseTauriLocalConfig("")).toBe(false);

    vi.mocked(isTauri).mockReturnValue(true);
    expect(shouldUseTauriLocalConfig("")).toBe(true);
    expect(shouldUseTauriLocalConfig("?config=/assets/examples/basic/config.json")).toBe(
      false
    );
  });

  it("chooses one local config file through the Tauri dialog", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/opjrd/config.json");

    await expect(chooseTauriConfigPath()).resolves.toBe("/tmp/opjrd/config.json");
    expect(open).toHaveBeenCalledWith({
      title: "Choose OPJRD experiment config",
      directory: false,
      multiple: false,
      filters: [
        {
          name: "JSON config",
          extensions: ["json"],
        },
      ],
    });
  });

  it("chooses one local experiment config folder through the Tauri dialog", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/opjrd");

    await expect(chooseTauriConfigFolderPath()).resolves.toBe("/tmp/opjrd");
    expect(open).toHaveBeenCalledWith({
      title: "Choose OPJRD experiment config folder",
      directory: true,
      multiple: false,
      canCreateDirectories: true,
    });
  });

  it("does not expose absolute local config paths in session metadata", () => {
    expect(localConfigDisplayPath("/tmp/opjrd/config.json")).toBe(
      "tauri-local:config.json"
    );
    expect(localConfigDisplayPath("D:\\Study\\OPJRD\\config.json")).toBe(
      "tauri-local:config.json"
    );
    expect(localConfigFolderDisplayPath("/tmp/opjrd-study")).toBe(
      "tauri-local-folder:opjrd-study/config.json"
    );
  });

  it("uses non-technical local labels in the config editor header", () => {
    expect(localConfigEditorLabel("/tmp/opjrd/config.json")).toBe(
      "Experiment config: opjrd/config.json"
    );
    expect(localConfigEditorLabel("D:\\Study\\OPJRD\\config.json")).toBe(
      "Experiment config: OPJRD/config.json"
    );
    expect(localConfigFolderEditorLabel("/tmp/opjrd")).toBe(
      "Experiment config: opjrd/config.json"
    );
  });

  it("loads a Tauri config and resolves related files through the selected config", async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const request = args as { relativePath: string | null };
      if (command === "read_experiment_asset_file") {
        return "data:image/svg+xml;base64,PHN2Zy8+";
      }
      if (request.relativePath === null) {
        return JSON.stringify({
          experimentName: "Local OPJRD experiment",
          locationsFile: "input/locations.csv",
          trialsFile: "input/trials.csv",
        });
      }
      if (request.relativePath === "input/locations.csv") {
        return "location,x,y\nA,0,0\nB,0,1\nC,1,1\n";
      }
      if (request.relativePath === "input/trials.csv") {
        return "trial_id,location,direction,target\n1,A,B,C\n";
      }
      throw new Error(String(request.relativePath));
    });

    const source = await loadTauriExperimentSource("/tmp/opjrd/config.json");

    expect(source.config.experimentName).toBe("Local OPJRD experiment");
    expect(source.config.locationsFile).toBe("input/locations.csv");
    expect(source.configPath).toBe("tauri-local:config.json");
    expect(source.localConfigPath).toBe("/tmp/opjrd/config.json");
    expect(source.sourceLabel).toBe("Experiment config: opjrd/config.json");
    await expect(source.fileLoader.loadTextFile(source.config.locationsFile)).resolves.toContain(
      "location,x,y"
    );
    await expect(source.fileLoader.loadAssetUrl("images/A.svg")).resolves.toMatch(
      /^data:image\/svg\+xml;base64,/u
    );
    expect(invoke).toHaveBeenCalledWith("read_experiment_text_file", {
      configPath: "/tmp/opjrd/config.json",
      relativePath: null,
    });
    expect(invoke).toHaveBeenCalledWith("read_experiment_text_file", {
      configPath: "/tmp/opjrd/config.json",
      relativePath: "input/locations.csv",
    });
    expect(invoke).toHaveBeenCalledWith("read_experiment_asset_file", {
      configPath: "/tmp/opjrd/config.json",
      relativePath: "images/A.svg",
    });
  });

  it("can load a Tauri config for editing when file extensions need fixing", async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const request = args as { relativePath: string | null };
      if (command === "read_experiment_text_file" && request.relativePath === null) {
        return JSON.stringify({
          experimentName: "Local OPJRD experiment",
          locationsFile: "locations.ods",
          trialsFile: "trials.ods",
          response: {
            stimuli: {
              mode: "image",
              images: {
                C: "assets/object-c.tiff",
              },
            },
          },
        });
      }
      throw new Error(String(command));
    });

    await expect(
      loadTauriExperimentSource("/tmp/opjrd/config.json")
    ).rejects.toThrow(/Unsupported locations file format/u);

    const source = await loadTauriExperimentSourceForEditing(
      "/tmp/opjrd/config.json"
    );

    expect(source.config.locationsFile).toBe("locations.ods");
    expect(source.config.trialsFile).toBe("trials.ods");
    expect(source.config.response.stimuli.images.C).toBe("assets/object-c.tiff");
  });

  it("chooses a stimulus image and returns a portable relative path", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/opjrd/assets/object-a.svg");
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "relative_experiment_file_path") {
        return "assets/object-a.svg";
      }
      if (command === "read_experiment_asset_file") {
        return "data:image/svg+xml;base64,PHN2Zy8+";
      }
      throw new Error(String(command));
    });

    await expect(
      chooseTauriStimulusImage("/tmp/opjrd/config.json")
    ).resolves.toEqual({
      relativePath: "assets/object-a.svg",
    });
    expect(open).toHaveBeenCalledWith({
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
    expect(invoke).toHaveBeenCalledWith("relative_experiment_file_path", {
      configPath: "/tmp/opjrd/config.json",
      filePath: "/tmp/opjrd/assets/object-a.svg",
    });
  });

  it("chooses a stimulus image relative to a new config folder", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/opjrd/assets/object-a.svg");
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "relative_experiment_folder_file_path") {
        return "assets/object-a.svg";
      }
      throw new Error(String(command));
    });

    await expect(
      chooseTauriStimulusImageInFolder("/tmp/opjrd")
    ).resolves.toEqual({
      relativePath: "assets/object-a.svg",
    });
    expect(invoke).toHaveBeenCalledWith("relative_experiment_folder_file_path", {
      folderPath: "/tmp/opjrd",
      filePath: "/tmp/opjrd/assets/object-a.svg",
    });
  });

  it("validates a typed Tauri stimulus image path", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await expect(
      validateTauriStimulusImagePath(
        "/tmp/opjrd/config.json",
        "assets/object-a.png"
      )
    ).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledWith("validate_experiment_asset_file", {
      configPath: "/tmp/opjrd/config.json",
      relativePath: "assets/object-a.png",
    });
  });

  it("validates a typed Tauri experiment data file path", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await expect(
      validateTauriExperimentDataFilePath(
        "/tmp/opjrd/config.json",
        "locations.csv"
      )
    ).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledWith("validate_experiment_data_file", {
      configPath: "/tmp/opjrd/config.json",
      relativePath: "locations.csv",
    });
  });

  it("validates a typed Tauri stimulus image path relative to a new config folder", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await expect(
      validateTauriStimulusImagePathInFolder(
        "/tmp/opjrd",
        "assets/object-a.png"
      )
    ).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledWith("validate_experiment_folder_asset_file", {
      folderPath: "/tmp/opjrd",
      relativePath: "assets/object-a.png",
    });
  });

  it("validates a typed Tauri experiment data file path relative to a new config folder", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await expect(
      validateTauriExperimentDataFilePathInFolder(
        "/tmp/opjrd",
        "trials.csv"
      )
    ).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledWith("validate_experiment_folder_data_file", {
      folderPath: "/tmp/opjrd",
      relativePath: "trials.csv",
    });
  });
});
