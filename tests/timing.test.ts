import { describe, expect, it } from "vitest";
import {
  buildSharedTrialData,
  calculateResponseLatencyMsec,
} from "../src/core/timing";
import type { TrialGeometry, TrialTimingEvents } from "../src/core/types";

const events: TrialTimingEvents = {
  a_onset_msec: 0,
  b_onset_msec: 1000,
  c_onset_msec: 1500,
  response_finalisation_msec: 4321,
};

const trial: TrialGeometry = {
  trialId: "1",
  location: "A",
  direction: "B",
  target: "C",
  truePosition: { x: -4, y: 4 },
  trueAngle: Math.PI / 4,
  trueAngleDeg: 45,
  trueDistance: Math.sqrt(32),
  imaginedHeading: Math.PI / 4,
  imaginedHeadingDeg: 45,
};

describe("shared timing model", () => {
  it("calculates response latency from A onset", () => {
    expect(calculateResponseLatencyMsec(events, "a_onset")).toBe(4321);
  });

  it("calculates response latency from B onset", () => {
    expect(calculateResponseLatencyMsec(events, "b_onset")).toBe(3321);
  });

  it("calculates response latency from C onset", () => {
    expect(calculateResponseLatencyMsec(events, "c_onset")).toBe(2821);
  });

  it("builds shared trial data with imagined-heading fields", () => {
    const data = buildSharedTrialData(
      "object_placement",
      trial,
      events,
      "c_onset",
      true,
      true
    );

    expect(data.task_mode).toBe("object_placement");
    expect(data.resp_latency_msec).toBe(2821);
    expect(data.a_onset_msec).toBe(0);
    expect(data.trial_gate_warning_shown).toBe(true);
    expect(data.imagined_heading_deg).toBe(45);
    expect(data.response_finalisation_msec).toBe(4321);
  });

  it("rejects finalisation before C onset", () => {
    expect(() =>
      calculateResponseLatencyMsec(
        {
          a_onset_msec: 0,
          b_onset_msec: 1000,
          c_onset_msec: 1500,
          response_finalisation_msec: 1400,
        },
        "c_onset"
      )
    ).not.toThrow();

    expect(() =>
      buildSharedTrialData(
        "jrd",
        trial,
        {
          a_onset_msec: 0,
          b_onset_msec: 1000,
          c_onset_msec: 1500,
          response_finalisation_msec: 1400,
        },
        "c_onset",
        false,
        false
      )
    ).toThrow(/response_finalisation_msec/u);
  });
});
