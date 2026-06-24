import type { ExperimentModel } from "../core/experiment";
import type { LocaleText } from "../i18n/locale";
import JrdTrialPlugin from "../trials/jrd-plugin";
import ObjectPlacementTrialPlugin from "../trials/object-placement-plugin";
import {
  EMPTY_STIMULUS_ASSETS,
  type LoadedStimulusAssets,
} from "../trials/stimulus-assets";

type TimelineEntry = Record<string, unknown>;

function buildObjectPlacementTrial(
  model: ExperimentModel,
  trialIndex: number,
  text: LocaleText,
  stimulusAssets: LoadedStimulusAssets
): TimelineEntry {
  const lastTrial = trialIndex === model.trials.length - 1;

  return {
    type: ObjectPlacementTrialPlugin,
    trial_geometry: model.trials[trialIndex],
    timing: model.config.timing,
    response: model.config.response,
    stimulus_assets: stimulusAssets,
    iti_duration_msec: lastTrial
      ? 0
      : model.config.timing.interTrialIntervalMsec,
    at_label: text.trial.atLabel,
    facing_label: text.trial.facingLabel,
    place_label: text.trial.placeLabel,
    data: {
      stage: "trial",
      trial_id: model.trials[trialIndex].trialId,
    },
  };
}

function buildJrdTrial(
  model: ExperimentModel,
  trialIndex: number,
  text: LocaleText,
  stimulusAssets: LoadedStimulusAssets
): TimelineEntry {
  const lastTrial = trialIndex === model.trials.length - 1;

  return {
    type: JrdTrialPlugin,
    trial_geometry: model.trials[trialIndex],
    timing: model.config.timing,
    response: model.config.response,
    stimulus_assets: stimulusAssets,
    iti_duration_msec: lastTrial
      ? 0
      : model.config.timing.interTrialIntervalMsec,
    at_label: text.trial.atLabel,
    facing_label: text.trial.facingLabel,
    point_to_label: text.trial.pointToLabel,
    data: {
      stage: "trial",
      trial_id: model.trials[trialIndex].trialId,
    },
  };
}

export function buildModeTimeline(
  model: ExperimentModel,
  text: LocaleText,
  stimulusAssets: LoadedStimulusAssets = EMPTY_STIMULUS_ASSETS
): TimelineEntry[] {
  const timeline: TimelineEntry[] = [];

  model.trials.forEach((_, trialIndex) => {
    timeline.push(
      model.config.taskMode === "jrd"
        ? buildJrdTrial(model, trialIndex, text, stimulusAssets)
        : buildObjectPlacementTrial(model, trialIndex, text, stimulusAssets)
    );
  });

  return timeline;
}
