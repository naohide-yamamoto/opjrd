import { describe, expect, it } from "vitest";
import { normaliseExperimentConfig as normaliseStrictExperimentConfig } from "../src/core/config";
import { buildSharedTrialData } from "../src/core/timing";
import type { TrialGeometry } from "../src/core/types";
import {
  collectParticipantMetadata,
  interactiveParticipantMetadataFields,
} from "../src/data/participant-metadata";
import { buildSaveBundle } from "../src/data/save-adapters";
import {
  buildSessionEnvelope,
  collectRuntimeMetadata,
} from "../src/data/session";
import { canonicaliseTrialRows } from "../src/data/output-rows";
import {
  flattenSessionRowsForCsv,
  sessionToWideCsv,
} from "../src/data/csv-export";

const trial: TrialGeometry = {
  trialId: "1",
  location: "A",
  direction: "B",
  target: "C",
  truePosition: { x: 1, y: 2 },
  trueAngle: -0.5,
  trueAngleDeg: -28.64788975654116,
  trueDistance: Math.sqrt(5),
  imaginedHeading: 0.25,
  imaginedHeadingDeg: 14.32394487827058,
};

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

function makeRows() {
  return [
    {
      ...buildSharedTrialData(
        "object_placement",
        trial,
        {
          a_onset_msec: 0,
          b_onset_msec: 1000,
          c_onset_msec: 1500,
          response_finalisation_msec: 2500,
        },
        "a_onset",
        false,
        false
      ),
      true_angle: -0.5,
      placed_angle: -0.25,
    },
  ];
}

describe("participant metadata collection", () => {
  it("collects manual metadata from config", () => {
    const config = normaliseExperimentConfig({
      participantMetadata: {
        provider: "manual",
        manualValues: {
          participant_id: "P001",
          age: 22,
        },
      },
    });

    expect(collectParticipantMetadata(config)).toEqual({
      provider: "manual",
      values: {
        participant_id: "P001",
        age: 22,
      },
    });
  });

  it("collects configured URL metadata values", () => {
    const config = normaliseExperimentConfig({
      participantMetadata: {
        provider: "url",
        urlParameters: ["participant_id", "condition"],
      },
    });

    expect(
      collectParticipantMetadata(config, {
        urlSearch: "?participant_id=P002&condition=control&ignored=yes",
      })
    ).toEqual({
      provider: "url",
      values: {
        participant_id: "P002",
        condition: "control",
      },
    });
  });

  it("collects form metadata values", () => {
    const config = normaliseExperimentConfig({
      participantMetadata: {
        provider: "form",
        fields: [
          { name: "participant_id", label: "ID", type: "text" },
          {
            name: "condition",
            label: "Condition",
            type: "radio",
            options: ["practice"],
          },
        ],
      },
    });

    expect(
      collectParticipantMetadata(config, {
        formValues: {
          participant_id: "P003",
          condition: "practice",
          nested: { ignored: true } as never,
        },
      })
    ).toEqual({
      provider: "form",
      values: {
        participant_id: "P003",
        condition: "practice",
      },
    });
  });

  it("uses ID, age, gender, and condition as the default interactive metadata fields", () => {
    const config = normaliseExperimentConfig({
      participantMetadata: {
        provider: "form",
      },
    });

    expect(interactiveParticipantMetadataFields(config)).toEqual([
      { name: "participant_id", label: "ID", type: "text", options: [] },
      { name: "age", label: "Age", type: "number", options: [] },
      {
        name: "gender",
        label: "Gender",
        type: "radio",
        options: [
          { label: "Woman/Female", freeText: false },
          { label: "Man/Male", freeText: false },
          { label: "Non-binary", freeText: false },
          { label: "Different term", freeText: true },
          { label: "Prefer not to say", freeText: false },
        ],
      },
      {
        name: "condition",
        label: "Condition",
        type: "radio",
        options: [
          { label: "Condition 1", freeText: false },
          { label: "Condition 2", freeText: false },
        ],
      },
    ]);
  });
});

describe("session envelope and CSV output", () => {
  it("canonicalises trial rows before export", () => {
    const canonicalRows = canonicaliseTrialRows([
      {
        ...makeRows()[0],
        opjrd_row: true,
        stage: "trial",
        true_x: 1,
        true_y: 2,
        placed_x: 1.5,
        placed_y: 2.5,
        c_moved: true,
        extra_field: "ignored",
        trial_type: "opjrd-object-placement",
        trial_index: 2,
        time_elapsed: 3000,
        internal_node_id: "0.0-1.0",
        response_mode: "object_placement",
        rt: 2500,
        trial_gate_latency_msec: 500,
        warning_shown: true,
        move_required_warning_shown: false,
        trial_gate_warning_shown: false,
      },
    ]);

    expect(canonicalRows[0]).toMatchObject({
      task_mode: "object_placement",
      trial_id: "1",
      true_x: 1,
      placed_y: 2.5,
      move_required_warning_shown: false,
      trial_gate_warning_shown: false,
    });
    expect(canonicalRows[0]).not.toHaveProperty("opjrd_row");
    expect(canonicalRows[0]).not.toHaveProperty("stage");
    expect(canonicalRows[0]).not.toHaveProperty("extra_field");
    expect(canonicalRows[0]).not.toHaveProperty("trial_type");
    expect(canonicalRows[0]).not.toHaveProperty("internal_node_id");
    expect(canonicalRows[0]).not.toHaveProperty("response_mode");
    expect(canonicalRows[0]).not.toHaveProperty("rt");
    expect(canonicalRows[0]).not.toHaveProperty("trial_gate_latency_msec");
    expect(canonicalRows[0]).not.toHaveProperty("warning_shown");
  });

  it("rejects trial rows without a recognised task mode", () => {
    expect(() => canonicaliseTrialRows([{ trial_id: "1" }])).toThrow(
      /task_mode/u
    );
  });

  it("builds a JSON session envelope with participant metadata", async () => {
    const config = normaliseExperimentConfig({
      participantMetadata: {
        provider: "manual",
        manualValues: {
          participant_id: "P003",
        },
      },
    });
    const session = await buildSessionEnvelope(
      config,
      "assets/examples/basic/config.json",
      "abc123",
      makeRows(),
      collectParticipantMetadata(config)
    );

    expect(session.app_name).toBe(config.appName);
    expect(session.config_hash).toBe("abc123");
    expect(session.timestamp_iso).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    expect(session.timestamp_local).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/u
    );
    expect(session.participant_metadata).toEqual({
      provider: "manual",
      values: {
        participant_id: "P003",
      },
    });
    expect(session.rows).toHaveLength(1);
  });

  it("flattens participant metadata into each wide CSV row without session metadata", async () => {
    const config = normaliseExperimentConfig({
      participantMetadata: {
        provider: "manual",
        manualValues: {
          participant_id: "P004",
          age: 23,
        },
      },
    });
    const session = await buildSessionEnvelope(
      config,
      "assets/examples/basic/config.json",
      "abc123",
      makeRows(),
      collectParticipantMetadata(config)
    );

    const rows = flattenSessionRowsForCsv(session);
    const csv = sessionToWideCsv(session);

    expect(rows[0]?.participant_id).toBe("P004");
    expect(rows[0]?.age).toBe(23);
    expect(rows[0]?.task_mode).toBe("object_placement");
    expect(rows[0]).not.toHaveProperty("app_version");
    expect(csv.split("\r\n")[0]).toContain("participant_id,age,task_mode");
    expect(csv).toContain("P004,23,object_placement");
  });

  it("prefixes participant metadata columns that collide with trial row fields", async () => {
    const config = normaliseExperimentConfig({
      participantMetadata: {
        provider: "manual",
        manualValues: {
          task_mode: "metadata_value",
        },
      },
    });
    const session = await buildSessionEnvelope(
      config,
      "assets/examples/basic/config.json",
      "abc123",
      makeRows(),
      collectParticipantMetadata(config)
    );

    expect(flattenSessionRowsForCsv(session)[0]?.participant_task_mode).toBe(
      "metadata_value"
    );
  });

  it("adds CSV to the save bundle only when enabled", async () => {
    const disabledConfig = normaliseExperimentConfig({});
    const enabledConfig = normaliseExperimentConfig({
      save: {
        csvEnabled: true,
      },
    });
    const disabledSession = {
      ...(await buildSessionEnvelope(
        disabledConfig,
        "config.json",
        "hash",
        makeRows()
      )),
      session_id: "abcdef1234567890",
      timestamp_iso: "2026-05-11T08:54:30.123Z",
      timestamp_local: "2026-05-11T18:54:30.123+10:00",
    };
    const enabledSession = {
      ...(await buildSessionEnvelope(
        enabledConfig,
        "config.json",
        "hash",
        makeRows()
      )),
      session_id: "abcdef1234567890",
      timestamp_iso: "2026-05-11T08:54:30.123Z",
      timestamp_local: "2026-05-11T18:54:30.123+10:00",
    };

    expect(buildSaveBundle(disabledConfig, disabledSession).csv).toBeUndefined();
    expect(buildSaveBundle(enabledConfig, enabledSession).csv?.filename).toBe(
      "OPJRD_fixture_experiment_no_participant_id_abcdef12.csv"
    );
  });

  it("uses participant metadata in default save filenames", async () => {
    const config = normaliseExperimentConfig({
      save: {
        csvEnabled: true,
      },
      participantMetadata: {
        provider: "manual",
        manualValues: {
          participant_id: "P-001",
          condition: "Condition 1",
        },
      },
    });
    const session = {
      ...(await buildSessionEnvelope(
        config,
        "config.json",
        "hash",
        makeRows(),
        collectParticipantMetadata(config)
      )),
      session_id: "abcdef1234567890",
      timestamp_iso: "2026-05-11T08:54:30.123Z",
      timestamp_local: "2026-05-11T18:54:30.123+10:00",
    };
    const bundle = buildSaveBundle(config, session);

    expect(bundle.json.filename).toBe(
      "OPJRD_fixture_experiment_P-001_abcdef12.json"
    );
    expect(bundle.csv?.filename).toBe(
      "OPJRD_fixture_experiment_P-001_abcdef12.csv"
    );
  });

  it("supports custom save filename templates with participant metadata tokens", async () => {
    const config = normaliseExperimentConfig({
      save: {
        filenameTemplate:
          "{participant_id}_{condition}_{group}_{task_mode}_{experimentName}",
      },
      participantMetadata: {
        provider: "manual",
        manualValues: {
          pid: "P005",
          condition: "Control",
          group: "Group A",
        },
      },
    });
    const session = await buildSessionEnvelope(
      config,
      "config.json",
      "hash",
      makeRows(),
      collectParticipantMetadata(config)
    );

    expect(buildSaveBundle(config, session).json.filename).toBe(
      "P005_Control_Group_A_object_placement_OPJRD_fixture_experiment.json"
    );
  });

  it("uses no_group when group metadata is unavailable", async () => {
    const config = normaliseExperimentConfig({
      save: {
        filenameTemplate: "{experimentName}_{group}_{session_id}",
      },
    });
    const session = {
      ...(await buildSessionEnvelope(config, "config.json", "hash", makeRows())),
      session_id: "abcdef1234567890",
    };

    expect(buildSaveBundle(config, session).json.filename).toBe(
      "OPJRD_fixture_experiment_no_group_abcdef12.json"
    );
  });

  it("supports full session IDs and ISO timestamps in custom save filename templates", async () => {
    const config = normaliseExperimentConfig({
      save: {
        filenameTemplate: "{session_id_full}_{timestamp_iso}",
      },
    });
    const session = {
      ...(await buildSessionEnvelope(config, "config.json", "hash", makeRows())),
      session_id: "abcdef1234567890",
      timestamp_iso: "2026-05-11T08:54:30.123Z",
      timestamp_local: "2026-05-11T18:54:30.123+10:00",
    };

    expect(buildSaveBundle(config, session).json.filename).toBe(
      "abcdef1234567890_2026-05-11T08_54_30_123Z.json"
    );
  });

  it("rejects unsupported save filename template tokens during config loading", () => {
    expect(() =>
      normaliseExperimentConfig({
        save: {
          filenameTemplate: "{unknown}",
        },
      })
    ).toThrow(
      /Config error: Filename template contains unsupported token \{unknown\}\./u
    );
  });

  it("rejects multiple unsupported save filename template tokens during config loading", () => {
    expect(() =>
      normaliseExperimentConfig({
        save: {
          filenameTemplate: "{unknown}_{other}_{unknown}",
        },
      })
    ).toThrow(
      /Config error: Filename template contains unsupported tokens \{unknown\}, \{other\}\./u
    );
  });

  it("keeps save-time filename template validation as a safeguard", async () => {
    const config = normaliseExperimentConfig({});
    const unsafeConfig = {
      ...config,
      save: {
        ...config.save,
        filenameTemplate: "{unknown}",
      },
    };
    const session = await buildSessionEnvelope(
      unsafeConfig,
      "config.json",
      "hash",
      makeRows()
    );

    expect(() => buildSaveBundle(unsafeConfig, session)).toThrow(
      /Config error: Filename template contains unsupported token \{unknown\}\./u
    );
  });

  it("prefers high-entropy Chromium runtime metadata when available", async () => {
    const metadata = await collectRuntimeMetadata({
      language: "en-AU",
      platform: "MacIntel",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      userAgentData: {
        brands: [{ brand: "Chromium", version: "148" }],
        mobile: false,
        platform: "macOS",
        getHighEntropyValues: async () => ({
          architecture: "arm",
          bitness: "64",
          fullVersionList: [
            { brand: "Chromium", version: "148.0.7778.168" },
            { brand: "Google Chrome", version: "148.0.7778.168" },
          ],
          mobile: false,
          platform: "macOS",
          platformVersion: "26.4.0",
        }),
      },
    });

    expect(metadata.platform).toBe("MacIntel");
    expect(metadata.operating_system_name).toBe("macOS");
    expect(metadata.operating_system_version).toBe("26.4.0");
    expect(metadata.operating_system_version_source).toBe("user_agent_data");
    expect(metadata.browser_name).toBe("Chrome");
    expect(metadata.browser_version).toBe("148.0.7778.168");
    expect(metadata.browser_version_source).toBe("user_agent_data");
    expect(metadata.webview_or_browser_version).toBe("148.0.7778.168");
    expect(metadata.architecture).toBe("arm");
    expect(metadata.architecture_source).toBe("user_agent_data");
    expect(metadata.user_agent_data_platform).toBe("macOS");
    expect(metadata.user_agent_data_platform_version).toBe("26.4.0");
    expect(metadata.user_agent_data_mobile).toBe(false);
  });
});
