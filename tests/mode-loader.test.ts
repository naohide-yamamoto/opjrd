import { describe, expect, it } from "vitest";
import { normaliseExperimentConfig as normaliseStrictExperimentConfig } from "../src/core/config";
import type { ExperimentModel } from "../src/core/experiment";
import type { LocaleText } from "../src/i18n/locale";

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

const localeText: LocaleText = {
  instructions: {
    readyText: "Press the space bar to begin.",
    finishTitle: "Finished",
    finishText: "Click below to save this session.",
    finishButtonLabel: "Save",
  },
  trial: {
    atLabel: "At",
    facingLabel: "Facing",
    placeLabel: "Place",
    pointToLabel: "Point to",
  },
  status: {
    savedDownload: "Data downloaded locally as JSON.",
    savedDownloadWithCsv: "Data downloaded locally as JSON and CSV.",
    savedTauri: "Data saved locally as JSON.",
    savedTauriWithCsv: "Data saved locally as JSON and CSV.",
    savedJatos: "Data submitted to JATOS.",
    saving: "Saving data...",
    saveCancelled: "Save cancelled. Click Save to choose an output folder.",
    saveFailed: "Data save failed.",
  },
  metadata: {
    title: "Participant details",
    continueButtonLabel: "Continue",
    fieldRequiredMessage: "Enter a value.",
    selectionRequiredMessage: "Select an option.",
    freeTextRequiredMessage: "Enter the term.",
    wholeNumberRequiredMessage: "Enter a whole number greater than or equal to 0.",
  },
  postSave: {
    runSameConfigButtonLabel: "Run another session",
    selectDifferentConfigButtonLabel: "Select different config",
    backToInitialScreenButtonLabel: "Back to initial screen",
    browserConfigPrompt: "Enter a config path or URL.",
    browserConfigPathLabel: "Config path or URL",
    browserConfigPathPlaceholder: "/assets/examples/basic/config.json",
    loadConfigButtonLabel: "Load config",
    cancelButtonLabel: "Cancel",
    noConfigPathMessage: "Enter a config path or URL.",
    loadConfigFailed: "Could not load config.",
    noConfigSelected: "No config selected.",
  },
};

function makeModel(taskMode: "object_placement" | "jrd"): ExperimentModel {
  return {
    config: normaliseExperimentConfig({
      taskMode,
      timing: {
        interTrialIntervalMsec: 750,
      },
    }),
    locations: {},
    trials: [
      {
        trialId: "trial-1",
        location: "A",
        direction: "B",
        target: "C",
        truePosition: { x: 1, y: 1 },
        trueAngle: 0,
        trueAngleDeg: 0,
        trueDistance: Math.SQRT2,
        imaginedHeading: 0,
        imaginedHeadingDeg: 0,
      },
      {
        trialId: "trial-2",
        location: "B",
        direction: "A",
        target: "C",
        truePosition: { x: -1, y: 1 },
        trueAngle: 0,
        trueAngleDeg: 0,
        trueDistance: Math.SQRT2,
        imaginedHeading: 0,
        imaginedHeadingDeg: 0,
      },
    ],
  };
}

describe("mode timeline", () => {
  it("folds inter-trial intervals into trial plugins instead of adding blank ITI trials", async () => {
    globalThis.window ??= {} as Window & typeof globalThis;
    const { buildModeTimeline } = await import("../src/modes/mode-loader");
    const timeline = buildModeTimeline(makeModel("object_placement"), localeText);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.iti_duration_msec).toBe(750);
    expect(timeline[1]?.iti_duration_msec).toBe(0);
  });

  it("passes embedded ITI timing to JRD trials too", async () => {
    globalThis.window ??= {} as Window & typeof globalThis;
    const { buildModeTimeline } = await import("../src/modes/mode-loader");
    const timeline = buildModeTimeline(makeModel("jrd"), localeText);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.iti_duration_msec).toBe(750);
    expect(timeline[1]?.iti_duration_msec).toBe(0);
  });
});
