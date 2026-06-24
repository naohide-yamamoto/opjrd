import { scoreJrd, scoreObjectPlacement } from "../core/scoring";
import { buildSharedTrialData } from "../core/timing";
import type {
  Coordinate,
  LatencyStartEvent,
  SharedTrialData,
  TrialGeometry,
  TrialTimingEvents,
} from "../core/types";

export interface ObjectPlacementResponseSummary {
  placedPosition: Coordinate;
  cInitialPosition: Coordinate;
  cMoved: boolean;
  movementCount: number;
  finalisationAttempts: number;
  blockedFinalisationAttempts: number;
  finalisationKey: string;
  moveRequiredWarningShown: boolean;
  trialStartGateEnabled: boolean;
  trialGateWarningShown: boolean;
}

export interface JrdResponseSummary {
  estimatedAngle: number;
  pointerPosition: Coordinate;
  pointerMoved: boolean;
  finalisationMethod: "click";
  trialStartGateEnabled: boolean;
  trialGateWarningShown: boolean;
}

function formatFinalisationKeyForData(key: string): string {
  if (key === " " || key === "Spacebar" || key.toLowerCase() === "space") {
    return "space";
  }

  return key;
}

export type ObjectPlacementTrialData = SharedTrialData &
  ReturnType<typeof scoreObjectPlacement> & {
    opjrd_row: true;
    stage: "trial";
    c_initial_x: number;
    c_initial_y: number;
    c_moved: boolean;
    movement_count: number;
    finalisation_attempts: number;
    blocked_finalisation_attempts: number;
    finalisation_key: string;
    move_required_warning_shown: boolean;
  };

export type JrdTrialData = SharedTrialData &
  ReturnType<typeof scoreJrd> & {
    opjrd_row: true;
    stage: "trial";
    pointer_x: number;
    pointer_y: number;
    pointer_moved: boolean;
    finalisation_method: "click";
  };

export function buildObjectPlacementTrialData(
  trial: TrialGeometry,
  events: TrialTimingEvents,
  latencyStartEvent: LatencyStartEvent,
  response: ObjectPlacementResponseSummary
): ObjectPlacementTrialData {
  return {
    ...buildSharedTrialData(
      "object_placement",
      trial,
      events,
      latencyStartEvent,
      response.trialStartGateEnabled,
      response.trialGateWarningShown
    ),
    ...scoreObjectPlacement(trial.truePosition, response.placedPosition),
    opjrd_row: true,
    stage: "trial",
    c_initial_x: response.cInitialPosition.x,
    c_initial_y: response.cInitialPosition.y,
    c_moved: response.cMoved,
    movement_count: response.movementCount,
    finalisation_attempts: response.finalisationAttempts,
    blocked_finalisation_attempts: response.blockedFinalisationAttempts,
    finalisation_key: formatFinalisationKeyForData(response.finalisationKey),
    move_required_warning_shown: response.moveRequiredWarningShown,
  };
}

export function buildJrdTrialData(
  trial: TrialGeometry,
  events: TrialTimingEvents,
  latencyStartEvent: LatencyStartEvent,
  response: JrdResponseSummary
): JrdTrialData {
  return {
    ...buildSharedTrialData(
      "jrd",
      trial,
      events,
      latencyStartEvent,
      response.trialStartGateEnabled,
      response.trialGateWarningShown
    ),
    ...scoreJrd(trial.trueAngle, response.estimatedAngle),
    opjrd_row: true,
    stage: "trial",
    pointer_x: response.pointerPosition.x,
    pointer_y: response.pointerPosition.y,
    pointer_moved: response.pointerMoved,
    finalisation_method: response.finalisationMethod,
  };
}
