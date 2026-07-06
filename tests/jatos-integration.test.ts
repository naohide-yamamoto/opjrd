import { afterEach, describe, expect, it, vi } from "vitest";
import { normaliseExperimentConfig } from "../src/core/config";
import { collectParticipantMetadata } from "../src/data/participant-metadata";
import {
  JatosResultFileUnavailableError,
  jatosInternalSaveAdapter,
  type SaveBundle,
} from "../src/data/save-adapters";
import type { SessionEnvelope } from "../src/data/session";
import { loadJatosExperimentSource } from "../src/data/experiment-source";
import { waitForJatosOnLoad } from "../src/runtime/jatos";

function stubWindow(jatos: Record<string, unknown>): void {
  vi.stubGlobal("window", {
    location: {
      href: "https://jatos.example.test/publix/abc123/jatos.html",
    },
    jatos,
  });
}

function minimalSession(): SessionEnvelope {
  return {
    session_id: "session-00000001",
    app_name: "Object Placement and Judgement of Relative Direction Program",
    app_version: "0.1.2",
    experiment_name: "JATOS test",
    task_mode: "object_placement",
    locale: "en-AU",
    timestamp_iso: "2026-07-02T00:00:00.000Z",
    timestamp_local: "2026-07-02T10:00:00.000+10:00",
    config_path: "jatos:config.json",
    config_hash: "config-hash",
    zero_direction: { x: 0, y: 1 },
    runtime: {
      runtime_environment: "jatos",
      operating_system_name: null,
      operating_system_version: null,
      operating_system_version_source: null,
      browser_name: null,
      browser_version: null,
      browser_version_source: null,
      browser_engine: null,
      webview_or_browser_version: null,
      user_agent: "test",
      platform: "test",
      architecture: null,
      architecture_source: null,
      bitness: null,
      user_agent_data_platform: null,
      user_agent_data_platform_version: null,
      user_agent_data_mobile: null,
      browser_language: "en-AU",
    },
    participant_metadata: {
      provider: "jatos",
      values: {
        participant_id: "P001",
      },
    },
    rows: [],
  };
}

describe("JATOS integration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("waits for jatos.onLoad before starting the experiment", async () => {
    let onLoadCallback: (() => void) | undefined;
    stubWindow({
      onLoad: vi.fn((callback: () => void) => {
        onLoadCallback = callback;
      }),
    });

    const ready = waitForJatosOnLoad();
    let resolved = false;
    void ready.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
    onLoadCallback?.();
    await ready;
    expect(resolved).toBe(true);
  });

  it("loads an embedded JATOS config with files resolved relative to configPath", async () => {
    stubWindow({
      componentInput: {
        configPath: "study/config.json",
        config: {
          experimentName: "Embedded JATOS config",
          locationsFile: "locations.csv",
          trialsFile: "trials.csv",
          save: {
            destination: "jatos",
          },
        },
      },
    });

    const source = await loadJatosExperimentSource(
      "assets/examples/basic/config.json"
    );

    expect(source.config.experimentName).toBe("Embedded JATOS config");
    expect(source.config.save.destination).toBe("jatos");
    expect(source.configPath).toBe("jatos:study/config.json");
    expect(source.sourceLabel).toBe("JATOS config: study/config.json");
    expect(await source.fileLoader.loadAssetUrl("assets/object-a.svg")).toBe(
      "https://jatos.example.test/publix/abc123/study/assets/object-a.svg"
    );
  });

  it("collects primitive JATOS metadata from input and session values", () => {
    stubWindow({
      studyInput: {
        group: "study-group",
        nested: { ignored: true },
      },
      studySessionData: {
        participant_id: "P001",
      },
      batchSessionData: {
        condition: "batch-condition",
      },
      urlQueryParameters: {
        external_id: "abc",
      },
      componentInput: {
        condition: "component-condition",
        config: { ignored: true },
      },
    });

    const config = normaliseExperimentConfig({
      locationsFile: "locations.csv",
      trialsFile: "trials.csv",
      participantMetadata: {
        provider: "jatos",
      },
    });

    expect(collectParticipantMetadata(config)).toEqual({
      provider: "jatos",
      values: {
        group: "study-group",
        participant_id: "P001",
        condition: "component-condition",
        external_id: "abc",
      },
    });
  });

  it("submits JSON result data and uploads JSON and CSV result files", async () => {
    const submitResultData = vi.fn();
    const uploadResultFile = vi.fn();
    const endStudyWithoutRedirect = vi.fn();
    const session = minimalSession();
    const bundle: SaveBundle = {
      json: {
        filename: "opjrd-session.json",
        session,
      },
      csv: {
        filename: "opjrd-session.csv",
        text: "trial_id\r\n1\r\n",
      },
    };
    stubWindow({
      submitResultData,
      uploadResultFile,
      endStudyWithoutRedirect,
    });

    await jatosInternalSaveAdapter.save(bundle);

    expect(submitResultData).toHaveBeenCalledWith(session);
    expect(uploadResultFile).toHaveBeenCalledWith(
      JSON.stringify(session, null, 2),
      "opjrd-session.json"
    );
    expect(uploadResultFile).toHaveBeenCalledWith(
      "trial_id\r\n1\r\n",
      "opjrd-session.csv"
    );
    expect(endStudyWithoutRedirect).toHaveBeenCalledWith(
      true,
      "OPJRD session saved."
    );
  });

  it("fails clearly when JATOS CSV export is requested without result-file upload", async () => {
    const submitResultData = vi.fn();
    stubWindow({ submitResultData });

    await expect(
      jatosInternalSaveAdapter.save({
        json: {
          filename: "opjrd-session.json",
          session: minimalSession(),
        },
        csv: {
          filename: "opjrd-session.csv",
          text: "trial_id\r\n1\r\n",
        },
      })
    ).rejects.toThrow(JatosResultFileUnavailableError);
    expect(submitResultData).not.toHaveBeenCalled();
  });
});
