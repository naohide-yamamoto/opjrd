import { afterEach, describe, expect, it, vi } from "vitest";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { normaliseExperimentConfig as normaliseStrictExperimentConfig } from "../src/core/config";
import {
  JatosSaveUnavailableError,
  selectSaveAdapter,
  type SaveBundle,
} from "../src/data/save-adapters";
import type { RuntimeMetadata } from "../src/data/session";
import {
  joinTauriSavePath,
  tauriSaveAdapter,
  TauriSaveCancelledError,
} from "../src/data/tauri-save-adapter";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: vi.fn(),
}));

const REQUIRED_INPUT_FILES = {
  locationsFile: "locations.csv",
  trialsFile: "trials.csv",
};

function normaliseExperimentConfig(
  raw: Record<string, unknown> = {}
) {
  return normaliseStrictExperimentConfig({
    ...REQUIRED_INPUT_FILES,
    ...raw,
  });
}

function makeSaveBundle(): SaveBundle {
  const runtime: RuntimeMetadata = {
    runtime_environment: "tauri",
    operating_system_name: "macOS",
    operating_system_version: "26.4",
    operating_system_version_source: "user_agent_data",
    browser_name: "Safari",
    browser_version: "18.4",
    browser_version_source: "user_agent",
    browser_engine: "WebKit",
    webview_or_browser_version: "18.4",
    user_agent: "OPJRD test user agent",
    platform: "MacIntel",
    architecture: null,
    architecture_source: null,
    bitness: null,
    user_agent_data_platform: null,
    user_agent_data_platform_version: null,
    user_agent_data_mobile: null,
    browser_language: "en-AU",
  };

  return {
    json: {
      filename: "opjrd-session.json",
      session: {
        app_name: "Object Placement and Judgement of Relative Direction Program",
        app_version: "0.1.1",
        config_path: "config.json",
        config_hash: "hash",
        experiment_name: "OPJRD fixture experiment",
        locale: "en-AU",
        session_id: "session-1",
        task_mode: "object_placement",
        timestamp_iso: "2026-05-11T08:54:30.123Z",
        timestamp_local: "2026-05-11T18:54:30.123+10:00",
        zero_direction: {
          x: 0,
          y: 1,
        },
        runtime,
        participant_metadata: {
          provider: "none",
          values: {},
        },
        rows: [],
      },
    },
    csv: {
      filename: "opjrd-session.csv",
      text: "trial_id\r\n",
    },
  };
}

describe("Tauri save adapter", () => {
  afterEach(() => {
    vi.mocked(isTauri).mockReset();
    vi.mocked(open).mockReset();
    vi.mocked(writeTextFile).mockReset();
  });

  it("joins selected output directories and generated filenames", () => {
    expect(joinTauriSavePath("/tmp/opjrd", "session.json")).toBe(
      "/tmp/opjrd/session.json"
    );
    expect(joinTauriSavePath("/tmp/opjrd/", "session.json")).toBe(
      "/tmp/opjrd/session.json"
    );
    expect(joinTauriSavePath("C:\\Research\\OPJRD", "session.json")).toBe(
      "C:\\Research\\OPJRD\\session.json"
    );
  });

  it("is only available inside the Tauri runtime", () => {
    vi.mocked(isTauri).mockReturnValue(false);
    expect(tauriSaveAdapter.isAvailable()).toBe(false);

    vi.mocked(isTauri).mockReturnValue(true);
    expect(tauriSaveAdapter.isAvailable()).toBe(true);
  });

  it("writes JSON and optional CSV output into the selected directory", async () => {
    const bundle = makeSaveBundle();
    vi.mocked(open).mockResolvedValue("/tmp/opjrd-output");
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    await tauriSaveAdapter.save(bundle);

    expect(open).toHaveBeenCalledWith({
      title: "Choose where to save OPJRD data",
      directory: true,
      multiple: false,
      canCreateDirectories: true,
    });
    expect(writeTextFile).toHaveBeenNthCalledWith(
      1,
      "/tmp/opjrd-output/opjrd-session.json",
      JSON.stringify(bundle.json.session, null, 2)
    );
    expect(writeTextFile).toHaveBeenNthCalledWith(
      2,
      "/tmp/opjrd-output/opjrd-session.csv",
      "trial_id\r\n"
    );
  });

  it("throws a specific error when the output directory selection is cancelled", async () => {
    vi.mocked(open).mockResolvedValue(null);

    await expect(tauriSaveAdapter.save(makeSaveBundle())).rejects.toThrow(
      TauriSaveCancelledError
    );
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it("selects Tauri local save automatically in the desktop shell", () => {
    vi.mocked(isTauri).mockReturnValue(true);

    const adapter = selectSaveAdapter(normaliseExperimentConfig({}));

    expect(adapter.name).toBe("tauri");
  });

  it("selects browser download for local saves outside the desktop shell", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const adapter = selectSaveAdapter(normaliseExperimentConfig({}));

    expect(adapter.name).toBe("download");
  });

  it("fails clearly when JATOS save is requested outside JATOS", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    expect(() =>
      selectSaveAdapter(
        normaliseExperimentConfig({
          save: {
            destination: "jatos",
          },
        })
      )
    ).toThrow(JatosSaveUnavailableError);
  });
});
