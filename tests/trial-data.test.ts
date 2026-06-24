import { describe, expect, it } from "vitest";
import { degreesToRadians } from "../src/core/angles";
import type { TrialGeometry, TrialTimingEvents } from "../src/core/types";
import { formatMoveRequiredWarning } from "../src/trials/canvas-geometry";
import {
  buildJrdTrialData,
  buildObjectPlacementTrialData,
} from "../src/trials/trial-data";
import { formatTrialStartGateWarning } from "../src/trials/trial-rendering";
import { createTrialPhaseRuntime } from "../src/trials/trial-state";

const trial: TrialGeometry = {
  trialId: "trial-1",
  location: "Chair",
  direction: "Lamp",
  target: "Plant",
  truePosition: { x: 0, y: -4 },
  trueAngle: Math.PI,
  trueAngleDeg: 180,
  trueDistance: 4,
  imaginedHeading: degreesToRadians(90),
  imaginedHeadingDeg: 90,
};

const events: TrialTimingEvents = {
  a_onset_msec: 500,
  b_onset_msec: 1000,
  c_onset_msec: 1500,
  response_finalisation_msec: 3210,
};

describe("trial data builders", () => {
  it("builds object-placement rows with shared timing, scoring, and response state", () => {
    const row = buildObjectPlacementTrialData(trial, events, "c_onset", {
      placedPosition: { x: 0, y: -4 },
      cInitialPosition: { x: 0, y: 4.75 },
      cMoved: true,
      movementCount: 1,
      finalisationAttempts: 2,
      blockedFinalisationAttempts: 1,
      finalisationKey: " ",
      moveRequiredWarningShown: true,
      trialStartGateEnabled: true,
      trialGateWarningShown: true,
    });

    expect(row.opjrd_row).toBe(true);
    expect(row.resp_latency_msec).toBe(1710);
    expect(row.placed_angle_deg).toBeCloseTo(180, 8);
    expect(row.angular_error_signed_deg).toBeCloseTo(0, 8);
    expect(row.c_moved).toBe(true);
    expect(row.blocked_finalisation_attempts).toBe(1);
    expect(row.finalisation_key).toBe("space");
    expect(row.move_required_warning_shown).toBe(true);
    expect(row.trial_start_gate_enabled).toBe(true);
    expect(row.trial_gate_warning_shown).toBe(true);
  });

  it("keeps visible non-space finalisation keys unchanged in object-placement rows", () => {
    const row = buildObjectPlacementTrialData(trial, events, "c_onset", {
      placedPosition: { x: 0, y: -4 },
      cInitialPosition: { x: 0, y: 4.75 },
      cMoved: true,
      movementCount: 1,
      finalisationAttempts: 1,
      blockedFinalisationAttempts: 0,
      finalisationKey: "Enter",
      moveRequiredWarningShown: false,
      trialStartGateEnabled: false,
      trialGateWarningShown: false,
    });

    expect(row.finalisation_key).toBe("Enter");
  });

  it("builds JRD rows with click finalisation and pointer state", () => {
    const row = buildJrdTrialData(trial, events, "a_onset", {
      estimatedAngle: Math.PI,
      pointerPosition: { x: 0, y: -6 },
      pointerMoved: true,
      finalisationMethod: "click",
      trialStartGateEnabled: true,
      trialGateWarningShown: false,
    });

    expect(row.estimated_angle_deg).toBeCloseTo(180, 8);
    expect(row.angular_error_signed_deg).toBeCloseTo(0, 8);
    expect(row.pointer_y).toBe(-6);
    expect(row.pointer_moved).toBe(true);
    expect(row.finalisation_method).toBe("click");
  });
});

describe("trial warning text", () => {
  it("substitutes the configured finalisation key display placeholder", () => {
    expect(
      formatMoveRequiredWarning(
        "Move the target object before pressing the {finalisationKey}.",
        " "
      )
    ).toBe("Move the target object before pressing the space bar.");
  });

  it("substitutes the trial start gate button label placeholder", () => {
    expect(
      formatTrialStartGateWarning(
        "Please click the {label} button to begin a trial.",
        "Start"
      )
    ).toBe("Please click the Start button to begin a trial.");
  });
});

describe("shared trial phase runtime", () => {
  it("moves from A onset to B onset to response onset with shared timings", () => {
    let now = 0;
    const scheduled: Array<{ callback: () => void; delayMsec: number }> = [];
    const phaseRuntime = createTrialPhaseRuntime(
      {
        aToBDelayMsec: 1000,
        bToCDelayMsec: 500,
        latencyStartEvent: "a_onset",
        interTrialIntervalMsec: 750,
        firstTrialStartDelayMsec: 500,
      },
      () => now,
      {
        setTimeout: (callback, delayMsec) => {
          scheduled.push({ callback, delayMsec });
          return scheduled.length;
        },
        clearTimeout: () => undefined,
      }
    );

    phaseRuntime.start(250);
    expect(phaseRuntime.getState().phase).toBe("a");
    expect(phaseRuntime.getState().aOnsetMsec).toBe(250);
    expect(scheduled.map((entry) => entry.delayMsec)).toEqual([1000, 1500]);

    now = 1002;
    scheduled[0]?.callback();
    expect(phaseRuntime.getState().phase).toBe("b");
    expect(phaseRuntime.getState().bOnsetMsec).toBe(1002);

    now = 1504;
    scheduled[1]?.callback();
    expect(phaseRuntime.getState().phase).toBe("response");
    expect(phaseRuntime.getState().cOnsetMsec).toBe(1504);
  });
});
