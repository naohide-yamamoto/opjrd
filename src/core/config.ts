import { normaliseVector } from "./geometry";
import { assertSupportedFilenameTemplateTokens } from "./filename-template";
import {
  hasSupportedExperimentDataFileExtension,
  hasSupportedStimulusImageExtension,
  unsupportedExperimentDataFileFormatMessage,
  unsupportedStimulusImageFormatMessage,
} from "./file-validation";
import {
  APP_NAME,
  CANVAS_SHAPES,
  LATENCY_START_EVENTS,
  PARTICIPANT_METADATA_FIELD_TYPES,
  PARTICIPANT_METADATA_PROVIDERS,
  SAVE_DESTINATIONS,
  STIMULUS_RENDERING_MODES,
  TASK_MODES,
  type CanvasDisplayConfig,
  type Coordinate,
  type ExperimentConfig,
  type LatencyStartEvent,
  type ParticipantMetadataFieldType,
  type ParticipantMetadataProvider,
  type ParticipantMetadataValue,
  type SaveDestination,
  type StimulusRenderingConfig,
  type StimulusRenderingMode,
  type SupportLabelOffsetConfig,
  type TaskMode,
  type TextStyleConfig,
} from "./types";

type JsonObject = Record<string, unknown>;

type ConfigNormalisationMode = "strict" | "editor";

interface ConfigNormalisationOptions {
  mode?: ConfigNormalisationMode;
}

const DEFAULT_CONFIG: ExperimentConfig = {
  appName: APP_NAME,
  experimentName: "OPJRD fixture experiment",
  taskMode: "object_placement",
  locale: "en-AU",
  locationsFile: "locations.csv",
  trialsFile: "trials.csv",
  zeroDirection: { x: 0, y: 1 },
  randomiseTrials: false,
  timing: {
    aToBDelayMsec: 1000,
    bToCDelayMsec: 500,
    latencyStartEvent: "a_onset",
    interTrialIntervalMsec: 750,
    firstTrialStartDelayMsec: 1000,
  },
  response: {
    abDistance: 4,
    layoutRadius: 6,
    canvas: {
      objectPlacement: {
        shape: "circle",
        sizePx: 760,
        widthPx: 760,
        heightPx: 760,
        visible: true,
      },
      jrd: {
        shape: "square",
        sizePx: 760,
        widthPx: 760,
        heightPx: 760,
        visible: true,
      },
    },
    trialStartGate: {
      enabled: true,
      label: "Start",
      position: { x: 0, y: 0 },
      widthPx: null,
      heightPx: null,
      warningEnabled: true,
      warningDelayMsec: 5000,
      warningMessage:
        "Please click the {label} button to begin a trial.",
    },
    feedback: {
      colour: "#0b5fff",
      durationMsec: 1000,
    },
    text: {
      objectLabels: {
        colour: "#101828",
        sizePx: 48,
        fontFamily: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      },
      supportLabels: {
        colour: "#475467",
        sizePx: 28,
        fontFamily: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      },
      supportLabelOffsets: {
        at: { x: 0, y: 1 },
        facing: { x: 0, y: 1 },
        place: { x: 0, y: 0.85 },
        pointTo: { x: 0, y: 1 },
      },
    },
    stimuli: {
      mode: "text",
      imageSizePx: 72,
      images: {},
    },
    objectPlacement: {
      finalisationKey: " ",
      requireMoveBeforeFinalise: true,
      moveRequiredWarningMessage:
        "Move the target object before pressing the {finalisationKey}.",
      cInitialPosition: { x: 0, y: 4.75 },
    },
  },
  save: {
    destination: "local",
    csvEnabled: false,
    filenameTemplate: "{experimentName}_{participant_id}_{session_id}",
  },
  participantMetadata: {
    provider: "none",
    fields: [
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
    ],
    manualValues: {},
    urlParameters: [],
  },
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readObject(source: JsonObject, key: string): JsonObject {
  const value = source[key];
  return isObject(value) ? value : {};
}

function readString(source: JsonObject, key: string, fallback: string): string {
  const value = source[key];
  if (value === undefined || value === null) {
    return fallback;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function readRequiredString(
  source: JsonObject,
  key: string,
  fallback: string,
  mode: ConfigNormalisationMode = "strict"
): string {
  const value = source[key];
  if (value === undefined) {
    return fallback;
  }
  if (value === null) {
    return mode === "editor" ? "" : fallback;
  }

  const text = String(value).trim();
  if (text.length === 0) {
    if (mode === "editor") {
      return text;
    }
    throw new Error(`Config error: ${key} must be a non-empty string.`);
  }

  return text;
}

function readExperimentDataFilePath(
  source: JsonObject,
  key: string,
  label: string,
  fallback: string,
  mode: ConfigNormalisationMode
): string {
  if (mode === "strict" && source[key] === undefined) {
    throw new Error(`Config error: ${key} must be specified.`);
  }
  const path = readRequiredString(source, key, fallback, mode);
  if (mode === "strict" && !hasSupportedExperimentDataFileExtension(path)) {
    throw new Error(unsupportedExperimentDataFileFormatMessage(label, path));
  }

  return path;
}

function readBoolean(source: JsonObject, key: string, fallback: boolean): boolean {
  const value = source[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Config error: ${key} must be true or false.`);
  }
  return value;
}

function readPositiveNumber(
  source: JsonObject,
  key: string,
  fallback: number,
  mode: ConfigNormalisationMode = "strict"
): number {
  const value = source[key];
  if (value === undefined) {
    return fallback;
  }
  if (value === null || value === "") {
    return mode === "editor" ? ("" as unknown as number) : fallback;
  }

  const resolved = Number(value);
  if (!Number.isFinite(resolved) || resolved <= 0) {
    if (mode === "editor") {
      return Number.isFinite(resolved)
        ? resolved
        : (String(value) as unknown as number);
    }
    throw new Error(`Config error: ${key} must be a positive number.`);
  }

  return resolved;
}

function readNonNegativeNumber(
  source: JsonObject,
  key: string,
  fallback: number,
  mode: ConfigNormalisationMode = "strict"
): number {
  const value = source[key];
  if (value === undefined) {
    return fallback;
  }
  if (value === null || value === "") {
    return mode === "editor" ? ("" as unknown as number) : fallback;
  }

  const resolved = Number(value);
  if (!Number.isFinite(resolved) || resolved < 0) {
    if (mode === "editor") {
      return Number.isFinite(resolved)
        ? resolved
        : (String(value) as unknown as number);
    }
    throw new Error(`Config error: ${key} must be a non-negative number.`);
  }

  return resolved;
}

function readOptionalPositiveNumber(
  source: JsonObject,
  key: string,
  fallback: number | null,
  mode: ConfigNormalisationMode = "strict"
): number | null {
  const value = source[key];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const resolved = Number(value);
  if (!Number.isFinite(resolved) || resolved <= 0) {
    if (mode === "editor") {
      return Number.isFinite(resolved)
        ? resolved
        : (String(value) as unknown as number);
    }
    throw new Error(`Config error: ${key} must be null or a positive number.`);
  }

  return resolved;
}

function readCoordinate(
  source: JsonObject,
  key: string,
  fallback: Coordinate,
  mode: ConfigNormalisationMode = "strict"
): Coordinate {
  const value = source[key];
  if (!isObject(value)) {
    return fallback;
  }

  const readComponent = (axis: "x" | "y"): number => {
    const component = value[axis];
    if (
      component === undefined ||
      component === null ||
      (typeof component === "string" && component.trim().length === 0)
    ) {
      if (mode === "editor") {
        return "" as unknown as number;
      }
      throw new Error(`Config error: ${key}.${axis} must be a finite number.`);
    }

    const numberValue = Number(component);
    if (!Number.isFinite(numberValue)) {
      if (mode === "editor") {
        return String(component) as unknown as number;
      }
      throw new Error(`Config error: ${key}.${axis} must be a finite number.`);
    }

    return numberValue;
  };

  const coordinate = {
    x: readComponent("x"),
    y: readComponent("y"),
  };

  return coordinate;
}

function validateZeroDirection(zeroDirection: Coordinate): void {
  try {
    normaliseVector(zeroDirection, "zeroDirection");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "zeroDirection must not be a zero-length vector."
    ) {
      throw new Error(
        "Config error: zeroDirection must not be a zero-length vector."
      );
    }

    throw error;
  }
}

function readTextStyle(
  source: JsonObject,
  fallback: TextStyleConfig,
  mode: ConfigNormalisationMode
): TextStyleConfig {
  return {
    colour: readString(source, "colour", fallback.colour),
    sizePx: readPositiveNumber(source, "sizePx", fallback.sizePx, mode),
    fontFamily: readString(source, "fontFamily", fallback.fontFamily),
  };
}

function readSupportLabelOffsets(
  source: JsonObject,
  fallback: SupportLabelOffsetConfig,
  mode: ConfigNormalisationMode
): SupportLabelOffsetConfig {
  return {
    at: readCoordinate(source, "at", fallback.at, mode),
    facing: readCoordinate(source, "facing", fallback.facing, mode),
    place: readCoordinate(source, "place", fallback.place, mode),
    pointTo: readCoordinate(source, "pointTo", fallback.pointTo, mode),
  };
}

function readCanvasShape(
  source: JsonObject,
  fallback: CanvasDisplayConfig
): CanvasDisplayConfig["shape"] {
  const value = readString(source, "shape", fallback.shape);
  if (!CANVAS_SHAPES.includes(value as CanvasDisplayConfig["shape"])) {
    throw new Error(
      `Config error: canvas shape must be one of ${CANVAS_SHAPES.join(", ")}.`
    );
  }
  return value as CanvasDisplayConfig["shape"];
}

function readCanvasDisplayConfig(
  source: JsonObject,
  fallback: CanvasDisplayConfig,
  mode: ConfigNormalisationMode
): CanvasDisplayConfig {
  const shape = readCanvasShape(source, fallback);
  const sizePx = readPositiveNumber(source, "sizePx", fallback.sizePx, mode);
  const widthPx =
    shape === "rectangle"
      ? readPositiveNumber(source, "widthPx", sizePx, mode)
      : sizePx;
  const heightPx =
    shape === "rectangle"
      ? readPositiveNumber(source, "heightPx", sizePx, mode)
      : sizePx;

  return {
    shape,
    sizePx,
    widthPx,
    heightPx,
    visible: readBoolean(source, "visible", fallback.visible),
  };
}

function readFinalisationKey(
  source: JsonObject,
  fallback: string,
  mode: ConfigNormalisationMode
): string {
  const value = source.finalisationKey;
  if (value === undefined || value === null) {
    return fallback;
  }

  if (value === " ") {
    return " ";
  }

  const text = String(value).trim();
  if (text.length === 0) {
    if (mode === "editor") {
      return text;
    }
    throw new Error("Config error: finalisationKey must be a non-empty string.");
  }
  if (text.toLowerCase() === "space") {
    return " ";
  }

  return text;
}

function readStringArray(
  source: JsonObject,
  key: string,
  fallback: string[]
): string[] {
  const value = source[key];
  if (value === undefined) {
    return fallback;
  }
  if (!Array.isArray(value)) {
    throw new Error(`Config error: ${key} must be an array of strings.`);
  }

  return value.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(
        `Config error: ${key}[${index}] must be a non-empty string.`
      );
    }
    return item.trim();
  });
}

function readParticipantMetadataFieldType(
  value: unknown,
  key: string
): ParticipantMetadataFieldType {
  const text = typeof value === "string" ? value.trim() : "";
  if (!PARTICIPANT_METADATA_FIELD_TYPES.includes(text as ParticipantMetadataFieldType)) {
    throw new Error(
      `Config error: ${key} must be one of ${PARTICIPANT_METADATA_FIELD_TYPES.join(", ")}.`
    );
  }
  return text as ParticipantMetadataFieldType;
}

function readParticipantMetadataFieldOption(
  value: unknown,
  key: string
): ExperimentConfig["participantMetadata"]["fields"][number]["options"][number] {
  if (typeof value === "string") {
    const label = value.trim();
    if (label.length === 0) {
      throw new Error(`Config error: ${key} must be a non-empty string.`);
    }
    return { label, freeText: false };
  }

  if (!isObject(value)) {
    throw new Error(
      `Config error: ${key} must be a string or an option object.`
    );
  }

  const label = value.label;
  if (typeof label !== "string" || label.trim().length === 0) {
    throw new Error(`Config error: ${key}.label must be a non-empty string.`);
  }

  return {
    label: label.trim(),
    freeText: readBoolean(value, "freeText", false),
  };
}

function readParticipantMetadataFieldOptions(
  value: unknown,
  key: string,
  type: ParticipantMetadataFieldType
): ExperimentConfig["participantMetadata"]["fields"][number]["options"] {
  if (value === undefined || value === null) {
    if (type === "radio" || type === "select") {
      throw new Error(`Config error: ${key} must contain at least one option.`);
    }
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Config error: ${key} must be an array.`);
  }

  const options = value.map((item, index) =>
    readParticipantMetadataFieldOption(item, `${key}[${index}]`)
  );
  if ((type === "radio" || type === "select") && options.length === 0) {
    throw new Error(
      `Config error: ${key} must contain at least one option.`
    );
  }
  if ((type === "text" || type === "number") && options.length > 0) {
    throw new Error(
      `Config error: ${key} is only valid for radio and select metadata fields.`
    );
  }
  if (
    type === "select" &&
    options.some((option) => option.freeText)
  ) {
    throw new Error(
      `Config error: ${key} cannot contain free-text options when field type is select.`
    );
  }
  return options;
}

function readParticipantMetadataFields(
  source: JsonObject
): ExperimentConfig["participantMetadata"]["fields"] {
  const value = source.fields;
  if (value === undefined || value === null) {
    return DEFAULT_CONFIG.participantMetadata.fields;
  }
  if (!Array.isArray(value)) {
    throw new Error("Config error: participantMetadata.fields must be an array.");
  }
  if (value.length === 0) {
    throw new Error(
      "Config error: participantMetadata.fields must contain at least one field."
    );
  }

  const seenNames = new Set<string>();
  return value.map((item, index) => {
    const key = `participantMetadata.fields[${index}]`;
    if (!isObject(item)) {
      throw new Error(
        `Config error: ${key} must be a field object.`
      );
    }

    const rawName = item.name;
    if (typeof rawName !== "string" || rawName.trim().length === 0) {
      throw new Error(`Config error: ${key}.name must be a non-empty string.`);
    }
    const name = rawName.trim();
    if (seenNames.has(name)) {
      throw new Error(
        `Config error: participantMetadata.fields must not contain duplicate field names.`
      );
    }
    seenNames.add(name);

    const label = item.label;
    if (typeof label !== "string" || label.trim().length === 0) {
      throw new Error(`Config error: ${key}.label must be a non-empty string.`);
    }
    const type = readParticipantMetadataFieldType(item.type, `${key}.type`);

    return {
      name,
      label: label.trim(),
      type,
      options: readParticipantMetadataFieldOptions(
        item.options,
        `${key}.options`,
        type
      ),
    };
  });
}

function readParticipantMetadataValues(
  source: JsonObject,
  key: string
): Record<string, ParticipantMetadataValue> {
  const value = source[key];
  if (value === undefined) {
    return {};
  }
  if (!isObject(value)) {
    throw new Error(`Config error: ${key} must be an object.`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => {
      if (entryKey.trim().length === 0) {
        throw new Error(`Config error: ${key} must not contain empty keys.`);
      }
      if (
        typeof entryValue !== "string" &&
        typeof entryValue !== "number" &&
        typeof entryValue !== "boolean" &&
        entryValue !== null
      ) {
        throw new Error(
          `Config error: ${key}.${entryKey} must be a string, number, boolean, or null.`
        );
      }
      return [entryKey, entryValue];
    })
  );
}

function readTaskMode(source: JsonObject): TaskMode {
  const taskMode = readString(source, "taskMode", DEFAULT_CONFIG.taskMode);
  if (!TASK_MODES.includes(taskMode as TaskMode)) {
    throw new Error(
      `Config error: taskMode must be one of ${TASK_MODES.join(", ")}.`
    );
  }
  return taskMode as TaskMode;
}

function readLatencyStartEvent(source: JsonObject): LatencyStartEvent {
  const value = readString(
    source,
    "latencyStartEvent",
    DEFAULT_CONFIG.timing.latencyStartEvent
  );
  if (!LATENCY_START_EVENTS.includes(value as LatencyStartEvent)) {
    throw new Error(
      `Config error: timing.latencyStartEvent must be one of ${LATENCY_START_EVENTS.join(", ")}.`
    );
  }
  return value as LatencyStartEvent;
}

function readSaveDestination(source: JsonObject): SaveDestination {
  const value = readString(
    source,
    "destination",
    DEFAULT_CONFIG.save.destination
  );
  if (!SAVE_DESTINATIONS.includes(value as SaveDestination)) {
    throw new Error(
      `Config error: save.destination must be one of ${SAVE_DESTINATIONS.join(", ")}.`
    );
  }
  return value as SaveDestination;
}

function readFilenameTemplate(
  source: JsonObject,
  mode: ConfigNormalisationMode
): string {
  const value = readString(
    source,
    "filenameTemplate",
    DEFAULT_CONFIG.save.filenameTemplate
  );
  if (mode === "strict") {
    assertSupportedFilenameTemplateTokens(value);
  }
  return value;
}

function readParticipantMetadataProvider(
  source: JsonObject
): ParticipantMetadataProvider {
  const value = readString(
    source,
    "provider",
    DEFAULT_CONFIG.participantMetadata.provider
  );
  if (!PARTICIPANT_METADATA_PROVIDERS.includes(value as ParticipantMetadataProvider)) {
    throw new Error(
      `Config error: participantMetadata.provider must be one of ${PARTICIPANT_METADATA_PROVIDERS.join(", ")}.`
    );
  }
  return value as ParticipantMetadataProvider;
}

function readStimulusRenderingMode(
  source: JsonObject,
  fallback: StimulusRenderingMode
): StimulusRenderingMode {
  const value = readString(source, "mode", fallback);
  if (!STIMULUS_RENDERING_MODES.includes(value as StimulusRenderingMode)) {
    throw new Error(
      `Config error: response.stimuli.mode must be one of ${STIMULUS_RENDERING_MODES.join(", ")}.`
    );
  }
  return value as StimulusRenderingMode;
}

function readStimulusImagePaths(
  source: JsonObject,
  key: string,
  fallback: Record<string, string>,
  validateExtensions: boolean
): Record<string, string> {
  const value = source[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!isObject(value)) {
    throw new Error(`Config error: response.stimuli.${key} must be an object.`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([rawName, rawPath]) => {
      const name = rawName.trim();
      if (name.length === 0) {
        throw new Error(
          `Config error: response.stimuli.${key} must not contain empty object names.`
        );
      }
      if (typeof rawPath !== "string") {
        throw new Error(
          `Config error: response.stimuli.${key}.${name} must be a string path.`
        );
      }
      const path = rawPath.trim();
      if (path.length === 0) {
        throw new Error(
          `Config error: response.stimuli.${key}.${name} must be a non-empty string path.`
        );
      }
      if (validateExtensions && !hasSupportedStimulusImageExtension(path)) {
        throw new Error(unsupportedStimulusImageFormatMessage(name, path));
      }
      return [name, path];
    })
  );
}

function readStimulusRenderingConfig(
  source: JsonObject,
  fallback: StimulusRenderingConfig,
  normalisationMode: ConfigNormalisationMode
): StimulusRenderingConfig {
  const stimulusMode = readStimulusRenderingMode(source, fallback.mode);

  return {
    mode: stimulusMode,
    imageSizePx: readPositiveNumber(
      source,
      "imageSizePx",
      fallback.imageSizePx,
      normalisationMode
    ),
    images: readStimulusImagePaths(
      source,
      "images",
      fallback.images,
      normalisationMode === "strict" && stimulusMode === "image"
    ),
  };
}

export function normaliseExperimentConfig(
  rawConfig: unknown,
  options: ConfigNormalisationOptions = {}
): ExperimentConfig {
  const raw = isObject(rawConfig) ? rawConfig : {};
  const mode = options.mode ?? "strict";
  const timing = readObject(raw, "timing");
  const response = readObject(raw, "response");
  const canvas = readObject(response, "canvas");
  const objectPlacementCanvas = readObject(canvas, "objectPlacement");
  const jrdCanvas = readObject(canvas, "jrd");
  const trialStartGate = readObject(response, "trialStartGate");
  const feedback = readObject(response, "feedback");
  const text = readObject(response, "text");
  const objectLabels = readObject(text, "objectLabels");
  const supportLabels = readObject(text, "supportLabels");
  const supportLabelOffsets = readObject(text, "supportLabelOffsets");
  const stimuli = readObject(response, "stimuli");
  const objectPlacement = readObject(response, "objectPlacement");
  const save = readObject(raw, "save");
  const participantMetadata = readObject(raw, "participantMetadata");
  if (save.preferredAdapter !== undefined) {
    throw new Error(
      "Config error: save.preferredAdapter is no longer supported; use save.destination."
    );
  }
  if (participantMetadata.genderOptions !== undefined) {
    throw new Error(
      "Config error: participantMetadata.genderOptions is no longer supported; define gender options inside participantMetadata.fields."
    );
  }
  if (participantMetadata.conditionOptions !== undefined) {
    throw new Error(
      "Config error: participantMetadata.conditionOptions is no longer supported; define condition options inside participantMetadata.fields."
    );
  }

  const zeroDirection = readCoordinate(
    raw,
    "zeroDirection",
    DEFAULT_CONFIG.zeroDirection,
    mode
  );
  if (mode === "strict") {
    validateZeroDirection(zeroDirection);
  }
  const responseAbDistance = readPositiveNumber(
    response,
    "abDistance",
    DEFAULT_CONFIG.response.abDistance,
    mode
  );
  const numericResponseAbDistance =
    typeof responseAbDistance === "number" && Number.isFinite(responseAbDistance)
      ? responseAbDistance
      : DEFAULT_CONFIG.response.abDistance;
  const defaultCInitialPosition = {
    x: 0,
    y: numericResponseAbDistance + 0.75,
  };

  return {
    appName: readString(raw, "appName", DEFAULT_CONFIG.appName),
    experimentName: readString(
      raw,
      "experimentName",
      DEFAULT_CONFIG.experimentName
    ),
    taskMode: readTaskMode(raw),
    locale: readString(raw, "locale", DEFAULT_CONFIG.locale),
    locationsFile: readExperimentDataFilePath(
      raw,
      "locationsFile",
      "locations",
      DEFAULT_CONFIG.locationsFile,
      mode
    ),
    trialsFile: readExperimentDataFilePath(
      raw,
      "trialsFile",
      "trials",
      DEFAULT_CONFIG.trialsFile,
      mode
    ),
    zeroDirection,
    randomiseTrials: readBoolean(
      raw,
      "randomiseTrials",
      DEFAULT_CONFIG.randomiseTrials
    ),
    timing: {
      aToBDelayMsec: readNonNegativeNumber(
        timing,
        "aToBDelayMsec",
        DEFAULT_CONFIG.timing.aToBDelayMsec,
        mode
      ),
      bToCDelayMsec: readNonNegativeNumber(
        timing,
        "bToCDelayMsec",
        DEFAULT_CONFIG.timing.bToCDelayMsec,
        mode
      ),
      latencyStartEvent: readLatencyStartEvent(timing),
      interTrialIntervalMsec: readNonNegativeNumber(
        timing,
        "interTrialIntervalMsec",
        DEFAULT_CONFIG.timing.interTrialIntervalMsec,
        mode
      ),
      firstTrialStartDelayMsec: readNonNegativeNumber(
        timing,
        "firstTrialStartDelayMsec",
        DEFAULT_CONFIG.timing.firstTrialStartDelayMsec,
        mode
      ),
    },
    response: {
      abDistance: responseAbDistance,
      layoutRadius: readPositiveNumber(
        response,
        "layoutRadius",
        DEFAULT_CONFIG.response.layoutRadius,
        mode
      ),
      canvas: {
        objectPlacement: readCanvasDisplayConfig(
          objectPlacementCanvas,
          DEFAULT_CONFIG.response.canvas.objectPlacement,
          mode
        ),
        jrd: readCanvasDisplayConfig(
          jrdCanvas,
          DEFAULT_CONFIG.response.canvas.jrd,
          mode
        ),
      },
      trialStartGate: {
        enabled: readBoolean(
          trialStartGate,
          "enabled",
          DEFAULT_CONFIG.response.trialStartGate.enabled
        ),
        label: readString(
          trialStartGate,
          "label",
          DEFAULT_CONFIG.response.trialStartGate.label
        ),
        position: readCoordinate(
          trialStartGate,
          "position",
          DEFAULT_CONFIG.response.trialStartGate.position,
          mode
        ),
        widthPx: readOptionalPositiveNumber(
          trialStartGate,
          "widthPx",
          DEFAULT_CONFIG.response.trialStartGate.widthPx,
          mode
        ),
        heightPx: readOptionalPositiveNumber(
          trialStartGate,
          "heightPx",
          DEFAULT_CONFIG.response.trialStartGate.heightPx,
          mode
        ),
        warningEnabled: readBoolean(
          trialStartGate,
          "warningEnabled",
          DEFAULT_CONFIG.response.trialStartGate.warningEnabled
        ),
        warningDelayMsec: readNonNegativeNumber(
          trialStartGate,
          "warningDelayMsec",
          DEFAULT_CONFIG.response.trialStartGate.warningDelayMsec,
          mode
        ),
        warningMessage: readString(
          trialStartGate,
          "warningMessage",
          DEFAULT_CONFIG.response.trialStartGate.warningMessage
        ),
      },
      feedback: {
        colour: readString(
          feedback,
          "colour",
          DEFAULT_CONFIG.response.feedback.colour
        ),
        durationMsec: readNonNegativeNumber(
          feedback,
          "durationMsec",
          DEFAULT_CONFIG.response.feedback.durationMsec,
          mode
        ),
      },
      text: {
        objectLabels: readTextStyle(
          objectLabels,
          DEFAULT_CONFIG.response.text.objectLabels,
          mode
        ),
        supportLabels: readTextStyle(
          supportLabels,
          DEFAULT_CONFIG.response.text.supportLabels,
          mode
        ),
        supportLabelOffsets: readSupportLabelOffsets(
          supportLabelOffsets,
          DEFAULT_CONFIG.response.text.supportLabelOffsets,
          mode
        ),
      },
      stimuli: readStimulusRenderingConfig(
        stimuli,
        DEFAULT_CONFIG.response.stimuli,
        mode
      ),
      objectPlacement: {
        finalisationKey: readFinalisationKey(
          objectPlacement,
          DEFAULT_CONFIG.response.objectPlacement.finalisationKey,
          mode
        ),
        requireMoveBeforeFinalise: readBoolean(
          objectPlacement,
          "requireMoveBeforeFinalise",
          DEFAULT_CONFIG.response.objectPlacement.requireMoveBeforeFinalise
        ),
        moveRequiredWarningMessage: readString(
          objectPlacement,
          "moveRequiredWarningMessage",
          DEFAULT_CONFIG.response.objectPlacement.moveRequiredWarningMessage
        ),
        cInitialPosition: readCoordinate(
          objectPlacement,
          "cInitialPosition",
          defaultCInitialPosition,
          mode
        ),
      },
    },
    save: {
      destination: readSaveDestination(save),
      csvEnabled: readBoolean(save, "csvEnabled", DEFAULT_CONFIG.save.csvEnabled),
      filenameTemplate: readFilenameTemplate(save, mode),
    },
    participantMetadata: {
      provider: readParticipantMetadataProvider(participantMetadata),
      fields: readParticipantMetadataFields(participantMetadata),
      manualValues: readParticipantMetadataValues(
        participantMetadata,
        "manualValues"
      ),
      urlParameters: readStringArray(
        participantMetadata,
        "urlParameters",
        DEFAULT_CONFIG.participantMetadata.urlParameters
      ),
    },
  };
}

export function createEditableConfigDraft(rawConfig: unknown): ExperimentConfig {
  return normaliseExperimentConfig(rawConfig, { mode: "editor" });
}

export async function loadJsonConfig(path: string): Promise<ExperimentConfig> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load config: ${path} (${response.status}).`);
  }

  return normaliseExperimentConfig(await response.json());
}
