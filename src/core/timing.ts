import type {
  LatencyStartEvent,
  SharedTrialData,
  TaskMode,
  TrialGeometry,
  TrialTimingEvents,
} from "./types";

export function getLatencyStartMsec(
  events: TrialTimingEvents,
  latencyStartEvent: LatencyStartEvent
): number {
  switch (latencyStartEvent) {
    case "a_onset":
      return events.a_onset_msec;
    case "b_onset":
      return events.b_onset_msec;
    case "c_onset":
      return events.c_onset_msec;
  }
}

export function calculateResponseLatencyMsec(
  events: TrialTimingEvents,
  latencyStartEvent: LatencyStartEvent
): number {
  return (
    events.response_finalisation_msec -
    getLatencyStartMsec(events, latencyStartEvent)
  );
}

export function validateTimingEvents(events: TrialTimingEvents): void {
  const values = [
    events.a_onset_msec,
    events.b_onset_msec,
    events.c_onset_msec,
    events.response_finalisation_msec,
  ];

  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Timing events must be finite non-negative millisecond values.");
  }

  if (events.b_onset_msec < events.a_onset_msec) {
    throw new Error("b_onset_msec must be greater than or equal to a_onset_msec.");
  }

  if (events.c_onset_msec < events.b_onset_msec) {
    throw new Error("c_onset_msec must be greater than or equal to b_onset_msec.");
  }

  if (events.response_finalisation_msec < events.c_onset_msec) {
    throw new Error(
      "response_finalisation_msec must be greater than or equal to c_onset_msec."
    );
  }
}

export function buildSharedTrialData(
  taskMode: TaskMode,
  trial: TrialGeometry,
  events: TrialTimingEvents,
  latencyStartEvent: LatencyStartEvent,
  trialStartGateEnabled: boolean,
  trialGateWarningShown: boolean
): SharedTrialData {
  validateTimingEvents(events);

  return {
    task_mode: taskMode,
    trial_id: trial.trialId,
    location: trial.location,
    direction: trial.direction,
    target: trial.target,
    latency_start_event: latencyStartEvent,
    a_onset_msec: events.a_onset_msec,
    b_onset_msec: events.b_onset_msec,
    c_onset_msec: events.c_onset_msec,
    response_finalisation_msec: events.response_finalisation_msec,
    resp_latency_msec: calculateResponseLatencyMsec(events, latencyStartEvent),
    trial_start_gate_enabled: trialStartGateEnabled,
    trial_gate_warning_shown: trialGateWarningShown,
    imagined_heading: trial.imaginedHeading,
    imagined_heading_deg: trial.imaginedHeadingDeg,
  };
}
