import type {
  ExperimentConfig,
  ParticipantMetadataFieldConfig,
  ParticipantMetadataProvider,
  ParticipantMetadataValue,
} from "../core/types";
import type { ParticipantMetadataBlock } from "./session";

export interface ParticipantMetadataSource {
  formValues?: Record<string, ParticipantMetadataValue>;
  jatosValues?: Record<string, ParticipantMetadataValue>;
  manualValues?: Record<string, ParticipantMetadataValue>;
  urlSearch?: string;
}

declare global {
  interface Window {
    jatos?: {
      batchSessionData?: unknown;
      componentJsonInput?: unknown;
      studySessionData?: unknown;
      submitResultData?: (data: unknown) => Promise<unknown> | void;
    };
  }
}

const DEFAULT_URL_PARAMETERS = ["participant_id", "participantId", "pid"];
function isMetadataValue(value: unknown): value is ParticipantMetadataValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

function keepPrimitiveMetadata(
  values: Record<string, unknown> | undefined
): Record<string, ParticipantMetadataValue> {
  if (!values) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, ParticipantMetadataValue] =>
      isMetadataValue(entry[1])
    )
  );
}

function readWindowJatosValues(): Record<string, ParticipantMetadataValue> {
  if (typeof window === "undefined" || !window.jatos) {
    return {};
  }

  return {
    ...keepPrimitiveMetadata(asRecord(window.jatos.studySessionData)),
    ...keepPrimitiveMetadata(asRecord(window.jatos.batchSessionData)),
    ...keepPrimitiveMetadata(asRecord(window.jatos.componentJsonInput)),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readUrlValues(
  config: ExperimentConfig,
  source: ParticipantMetadataSource
): Record<string, ParticipantMetadataValue> {
  const search =
    source.urlSearch ??
    (typeof window === "undefined" ? "" : window.location.search);
  const params = new URLSearchParams(search);
  const names =
    config.participantMetadata.urlParameters.length > 0
      ? config.participantMetadata.urlParameters
      : DEFAULT_URL_PARAMETERS;

  return Object.fromEntries(
    names.flatMap((name) => {
      const value = params.get(name);
      return value === null ? [] : [[name, value]];
    })
  );
}

export function interactiveParticipantMetadataFields(
  config: ExperimentConfig
): ParticipantMetadataFieldConfig[] {
  return config.participantMetadata.fields;
}

function metadataValuesForProvider(
  provider: ParticipantMetadataProvider,
  config: ExperimentConfig,
  source: ParticipantMetadataSource
): Record<string, ParticipantMetadataValue> {
  switch (provider) {
    case "none":
      return {};
    case "form":
      return keepPrimitiveMetadata(source.formValues);
    case "jatos":
      return {
        ...readWindowJatosValues(),
        ...keepPrimitiveMetadata(source.jatosValues),
      };
    case "manual":
      return {
        ...config.participantMetadata.manualValues,
        ...keepPrimitiveMetadata(source.manualValues),
      };
    case "url":
      return readUrlValues(config, source);
  }
}

export function collectParticipantMetadata(
  config: ExperimentConfig,
  source: ParticipantMetadataSource = {}
): ParticipantMetadataBlock {
  return {
    provider: config.participantMetadata.provider,
    values: metadataValuesForProvider(
      config.participantMetadata.provider,
      config,
      source
    ),
  };
}
