import { normaliseExperimentConfig } from "../core/config";
import type {
  CanvasDisplayConfig,
  ExperimentConfig,
  ParticipantMetadataConfig,
  ParticipantMetadataFieldConfig,
  ParticipantMetadataValue,
} from "../core/types";

type ConfigJson = Record<string, unknown>;

export function createDefaultEditorConfig(): ExperimentConfig {
  return normaliseExperimentConfig({
    experimentName: "OPJRD experiment",
    locationsFile: "locations.csv",
    trialsFile: "trials.csv",
  });
}

function serialiseFinalisationKey(key: string): string {
  return key === " " ? "space" : key;
}

function serialiseCanvas(canvas: CanvasDisplayConfig): ConfigJson {
  const base: ConfigJson = {
    shape: canvas.shape,
    sizePx: canvas.sizePx,
    visible: canvas.visible,
  };

  if (canvas.shape === "rectangle") {
    base.widthPx = canvas.widthPx;
    base.heightPx = canvas.heightPx;
  }

  return base;
}

function serialiseMetadataField(
  field: ParticipantMetadataFieldConfig
): ConfigJson {
  const serialised: ConfigJson = {
    name: field.name,
    label: field.label,
    type: field.type,
  };

  if (field.options.length > 0) {
    serialised.options = field.options.map((option) =>
      option.freeText
        ? { label: option.label, freeText: true }
        : option.label
    );
  }

  return serialised;
}

function serialiseParticipantMetadata(
  participantMetadata: ParticipantMetadataConfig
): ConfigJson {
  return {
    provider: participantMetadata.provider,
    fields: participantMetadata.fields.map(serialiseMetadataField),
    manualValues: participantMetadata.manualValues,
    urlParameters: participantMetadata.urlParameters,
  };
}

export function serialiseExperimentConfig(config: ExperimentConfig): ConfigJson {
  const response: ConfigJson = {
    abDistance: config.response.abDistance,
    layoutRadius: config.response.layoutRadius,
    canvas: {
      objectPlacement: serialiseCanvas(config.response.canvas.objectPlacement),
      jrd: serialiseCanvas(config.response.canvas.jrd),
    },
    trialStartGate: config.response.trialStartGate,
    feedback: config.response.feedback,
    text: config.response.text,
    stimuli: config.response.stimuli,
  };

  if (config.taskMode === "object_placement") {
    response.objectPlacement = {
      ...config.response.objectPlacement,
      finalisationKey: serialiseFinalisationKey(
        config.response.objectPlacement.finalisationKey
      ),
    };
  }

  return {
    appName: config.appName,
    experimentName: config.experimentName,
    taskMode: config.taskMode,
    locale: config.locale,
    locationsFile: config.locationsFile,
    trialsFile: config.trialsFile,
    zeroDirection: config.zeroDirection,
    randomiseTrials: config.randomiseTrials,
    timing: config.timing,
    response,
    save: config.save,
    participantMetadata: serialiseParticipantMetadata(
      config.participantMetadata
    ),
  };
}

export function configToJsonText(config: ExperimentConfig): string {
  return `${JSON.stringify(serialiseExperimentConfig(config), null, 2)}\n`;
}

export function parseManualMetadataJson(
  value: string
): Record<string, ParticipantMetadataValue> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {};
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Manual participant metadata must be a JSON object.");
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, item]) => {
      if (
        typeof item !== "string" &&
        typeof item !== "number" &&
        typeof item !== "boolean" &&
        item !== null
      ) {
        throw new Error(
          `Manual participant metadata value '${key}' must be a string, number, boolean, or null.`
        );
      }
      return [key, item];
    })
  );
}
