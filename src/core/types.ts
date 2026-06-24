export const APP_NAME =
  "Object Placement and Judgement of Relative Direction Program";

export const TASK_MODES = ["object_placement", "jrd"] as const;
export type TaskMode = (typeof TASK_MODES)[number];

export const LATENCY_START_EVENTS = [
  "a_onset",
  "b_onset",
  "c_onset",
] as const;
export type LatencyStartEvent = (typeof LATENCY_START_EVENTS)[number];

export const PARTICIPANT_METADATA_PROVIDERS = [
  "none",
  "form",
  "url",
  "manual",
  "jatos",
] as const;
export type ParticipantMetadataProvider =
  (typeof PARTICIPANT_METADATA_PROVIDERS)[number];

export type ParticipantMetadataValue = string | number | boolean | null;

export const PARTICIPANT_METADATA_FIELD_TYPES = [
  "text",
  "number",
  "radio",
  "select",
] as const;
export type ParticipantMetadataFieldType =
  (typeof PARTICIPANT_METADATA_FIELD_TYPES)[number];

export interface Coordinate {
  x: number;
  y: number;
}

export interface LocationRecord extends Coordinate {
  name: string;
}

export type LocationIndex = Record<string, Coordinate>;

export interface TrialReference {
  trialId: string;
  location: string;
  direction: string;
  target: string;
}

export interface TimingConfig {
  aToBDelayMsec: number;
  bToCDelayMsec: number;
  latencyStartEvent: LatencyStartEvent;
  interTrialIntervalMsec: number;
  firstTrialStartDelayMsec: number;
}

export interface ObjectPlacementConfig {
  finalisationKey: string;
  requireMoveBeforeFinalise: boolean;
  moveRequiredWarningMessage: string;
  cInitialPosition: Coordinate;
}

export interface TrialStartGateConfig {
  enabled: boolean;
  label: string;
  position: Coordinate;
  widthPx: number | null;
  heightPx: number | null;
  warningEnabled: boolean;
  warningDelayMsec: number;
  warningMessage: string;
}

export const CANVAS_SHAPES = ["square", "circle", "rectangle"] as const;
export type CanvasShape = (typeof CANVAS_SHAPES)[number];

export interface CanvasDisplayConfig {
  shape: CanvasShape;
  sizePx: number;
  widthPx: number;
  heightPx: number;
  visible: boolean;
}

export interface ResponseCanvasConfig {
  objectPlacement: CanvasDisplayConfig;
  jrd: CanvasDisplayConfig;
}

export interface TextStyleConfig {
  colour: string;
  sizePx: number;
  fontFamily: string;
}

export const STIMULUS_RENDERING_MODES = ["text", "image"] as const;
export type StimulusRenderingMode = (typeof STIMULUS_RENDERING_MODES)[number];

export interface StimulusRenderingConfig {
  mode: StimulusRenderingMode;
  imageSizePx: number;
  images: Record<string, string>;
}

export interface SupportLabelOffsetConfig {
  at: Coordinate;
  facing: Coordinate;
  place: Coordinate;
  pointTo: Coordinate;
}

export interface ResponseTextConfig {
  objectLabels: TextStyleConfig;
  supportLabels: TextStyleConfig;
  supportLabelOffsets: SupportLabelOffsetConfig;
}

export interface ResponseFeedbackConfig {
  colour: string;
  durationMsec: number;
}

export interface ResponseInterfaceConfig {
  abDistance: number;
  layoutRadius: number;
  canvas: ResponseCanvasConfig;
  trialStartGate: TrialStartGateConfig;
  feedback: ResponseFeedbackConfig;
  text: ResponseTextConfig;
  stimuli: StimulusRenderingConfig;
  objectPlacement: ObjectPlacementConfig;
}

export const SAVE_DESTINATIONS = ["local", "jatos"] as const;
export type SaveDestination = (typeof SAVE_DESTINATIONS)[number];

export interface SaveConfig {
  destination: SaveDestination;
  csvEnabled: boolean;
  filenameTemplate: string;
}

export interface ParticipantMetadataConfig {
  provider: ParticipantMetadataProvider;
  fields: ParticipantMetadataFieldConfig[];
  manualValues: Record<string, ParticipantMetadataValue>;
  urlParameters: string[];
}

export interface ParticipantMetadataFieldConfig {
  name: string;
  label: string;
  type: ParticipantMetadataFieldType;
  options: ParticipantMetadataFieldOption[];
}

export interface ParticipantMetadataFieldOption {
  label: string;
  freeText: boolean;
}

export interface ExperimentConfig {
  appName: string;
  experimentName: string;
  taskMode: TaskMode;
  locale: string;
  locationsFile: string;
  trialsFile: string;
  zeroDirection: Coordinate;
  randomiseTrials: boolean;
  timing: TimingConfig;
  response: ResponseInterfaceConfig;
  save: SaveConfig;
  participantMetadata: ParticipantMetadataConfig;
}

export interface TrialGeometry {
  trialId: string;
  location: string;
  direction: string;
  target: string;
  truePosition: Coordinate;
  trueAngle: number;
  trueAngleDeg: number;
  trueDistance: number;
  imaginedHeading: number;
  imaginedHeadingDeg: number;
}

export interface TrialTimingEvents {
  a_onset_msec: number;
  b_onset_msec: number;
  c_onset_msec: number;
  response_finalisation_msec: number;
}

export interface SharedTrialData {
  task_mode: TaskMode;
  trial_id: string;
  location: string;
  direction: string;
  target: string;
  latency_start_event: LatencyStartEvent;
  a_onset_msec: number;
  b_onset_msec: number;
  c_onset_msec: number;
  response_finalisation_msec: number;
  resp_latency_msec: number;
  trial_start_gate_enabled: boolean;
  trial_gate_warning_shown: boolean;
  imagined_heading: number;
  imagined_heading_deg: number;
}
