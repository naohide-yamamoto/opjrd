import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { degreesToRadians } from "../src/core/angles";
import { normaliseExperimentConfig } from "../src/core/config";
import { parseCsv } from "../src/core/csv";
import { buildExperimentModel } from "../src/core/experiment";
import type { ExperimentConfig, TrialTimingEvents } from "../src/core/types";
import { collectParticipantMetadata } from "../src/data/participant-metadata";
import { sessionToWideCsv } from "../src/data/csv-export";
import { canonicaliseTrialRows } from "../src/data/output-rows";
import type { RuntimeMetadata, SessionEnvelope } from "../src/data/session";
import {
  buildJrdTrialData,
  buildObjectPlacementTrialData,
} from "../src/trials/trial-data";

type GoldenFixtureName = "jrd" | "object-placement";

const fixtureRoot = (...parts: string[]) =>
  join(process.cwd(), "tests", "fixtures", "golden", ...parts);

const goldenRuntime: RuntimeMetadata = {
  runtime_environment: "browser",
  operating_system_name: "macOS",
  operating_system_version: "26.4.0",
  operating_system_version_source: "user_agent_data",
  browser_name: "Chrome",
  browser_version: "148.0.7778.168",
  browser_version_source: "user_agent_data",
  browser_engine: "Blink",
  webview_or_browser_version: "148.0.7778.168",
  user_agent: "OPJRD golden fixture user agent",
  platform: "MacIntel",
  architecture: "arm",
  architecture_source: "user_agent_data",
  bitness: "64",
  user_agent_data_platform: "macOS",
  user_agent_data_platform_version: "26.4.0",
  user_agent_data_mobile: false,
  browser_language: "en-AU",
};

function readGoldenText(
  fixtureName: GoldenFixtureName,
  filename: string
): string {
  return readFileSync(fixtureRoot(fixtureName, filename), "utf8");
}

function readGoldenJson(
  fixtureName: GoldenFixtureName,
  filename: string
): unknown {
  return JSON.parse(readGoldenText(fixtureName, filename));
}

function readExpectedCsv(fixtureName: GoldenFixtureName): string {
  return readGoldenText(fixtureName, "expected-session.csv")
    .trimEnd()
    .replaceAll(/\r?\n/gu, "\r\n");
}

function loadGoldenConfig(fixtureName: GoldenFixtureName): ExperimentConfig {
  return normaliseExperimentConfig(readGoldenJson(fixtureName, "config.json"));
}

function loadGoldenModel(config: ExperimentConfig, fixtureName: GoldenFixtureName) {
  return buildExperimentModel(
    config,
    parseCsv(readGoldenText(fixtureName, config.locationsFile)),
    parseCsv(readGoldenText(fixtureName, config.trialsFile))
  );
}

function buildStableSession(
  config: ExperimentConfig,
  fixtureName: GoldenFixtureName,
  configHash: string,
  timestampIso: string,
  timestampLocal: string,
  sessionId: string,
  rows: Record<string, unknown>[]
): SessionEnvelope {
  return {
    session_id: sessionId,
    app_name: config.appName,
    app_version: "0.1.1",
    experiment_name: config.experimentName,
    task_mode: config.taskMode,
    locale: config.locale,
    timestamp_iso: timestampIso,
    timestamp_local: timestampLocal,
    config_path: `tests/fixtures/golden/${fixtureName}/config.json`,
    config_hash: configHash,
    zero_direction: config.zeroDirection,
    runtime: goldenRuntime,
    participant_metadata: collectParticipantMetadata(config),
    rows,
  };
}

describe("golden output fixtures", () => {
  it("keeps object-placement JSON and CSV output stable", () => {
    const fixtureName = "object-placement";
    const config = loadGoldenConfig(fixtureName);
    const model = loadGoldenModel(config, fixtureName);
    const events: TrialTimingEvents = {
      a_onset_msec: 100,
      b_onset_msec: 700,
      c_onset_msec: 1100,
      response_finalisation_msec: 2500,
    };
    const rows = canonicaliseTrialRows([
      buildObjectPlacementTrialData(
        model.trials[0]!,
        events,
        config.timing.latencyStartEvent,
        {
          placedPosition: { x: 4, y: 3 },
          cInitialPosition: config.response.objectPlacement.cInitialPosition,
          cMoved: true,
          movementCount: 2,
          finalisationAttempts: 2,
          blockedFinalisationAttempts: 1,
          finalisationKey: config.response.objectPlacement.finalisationKey,
          moveRequiredWarningShown: true,
          trialStartGateEnabled: config.response.trialStartGate.enabled,
          trialGateWarningShown: false,
        }
      ) as unknown as Record<string, unknown>,
    ]);
    const session = buildStableSession(
      config,
      fixtureName,
      "golden-object-placement-config-hash",
      "2026-06-01T00:00:00.000Z",
      "2026-06-01T10:00:00.000+10:00",
      "golden-object-placement-session-00000001",
      rows
    );

    expect(session).toEqual(readGoldenJson(fixtureName, "expected-session.json"));
    expect(sessionToWideCsv(session)).toBe(readExpectedCsv(fixtureName));
  });

  it("keeps JRD JSON and CSV output stable", () => {
    const fixtureName = "jrd";
    const config = loadGoldenConfig(fixtureName);
    const model = loadGoldenModel(config, fixtureName);
    const events: TrialTimingEvents = {
      a_onset_msec: 200,
      b_onset_msec: 800,
      c_onset_msec: 1200,
      response_finalisation_msec: 1800,
    };
    const rows = canonicaliseTrialRows([
      buildJrdTrialData(
        model.trials[0]!,
        events,
        config.timing.latencyStartEvent,
        {
          estimatedAngle: degreesToRadians(90),
          pointerPosition: { x: 4, y: 0 },
          pointerMoved: true,
          finalisationMethod: "click",
          trialStartGateEnabled: config.response.trialStartGate.enabled,
          trialGateWarningShown: false,
        }
      ) as unknown as Record<string, unknown>,
    ]);
    const session = buildStableSession(
      config,
      fixtureName,
      "golden-jrd-config-hash",
      "2026-06-01T00:05:00.000Z",
      "2026-06-01T10:05:00.000+10:00",
      "golden-jrd-session-00000001",
      rows
    );

    expect(session).toEqual(readGoldenJson(fixtureName, "expected-session.json"));
    expect(sessionToWideCsv(session)).toBe(readExpectedCsv(fixtureName));
  });
});
