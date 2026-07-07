import {
  JsPsych,
  type JsPsychPlugin,
  ParameterType,
  type TrialType,
} from "jspsych";
import { angleFromUpAnticlockwise } from "../core/angles";
import type {
  Coordinate,
  ResponseInterfaceConfig,
  TextStyleConfig,
  TimingConfig,
  TrialGeometry,
  TrialTimingEvents,
} from "../core/types";
import {
  createCanvasMapping,
  fromCanvas,
  getCanvasPoint,
  offsetCoordinate,
  type CanvasMapping,
  toCanvas,
} from "./canvas-geometry";
import { buildJrdTrialData, type JrdTrialData } from "./trial-data";
import {
  configureTrialStartGateButton,
  drawNeutralTrialSurface,
  drawObjectStimulus,
  drawResponseCircle,
  formatTrialStartGateWarning,
  getPersistentTrialSurface,
  isClientPointInsideElement,
  prepareTrialRunPresentation,
  prepareTrialCanvas,
} from "./trial-rendering";
import {
  EMPTY_STIMULUS_ASSETS,
  type LoadedStimulusAssets,
} from "./stimulus-assets";
import { createTrialPhaseRuntime } from "./trial-state";

const JRD_WORLD_EXTENT = 12;
const JRD_LINE_START_RADIUS = 1;
const JRD_LABEL_RADIUS = 8.5;
const JRD_POINTER_MIN_RADIUS = 1;
const JRD_DIRECTION_POSITION: Coordinate = { x: 0, y: 7 };

const info = {
  name: "opjrd-jrd",
  version: "0.2.0",
  parameters: {
    trial_geometry: {
      type: ParameterType.OBJECT,
    },
    timing: {
      type: ParameterType.OBJECT,
    },
    response: {
      type: ParameterType.OBJECT,
    },
    stimulus_assets: {
      type: ParameterType.OBJECT,
      default: EMPTY_STIMULUS_ASSETS,
    },
    at_label: {
      type: ParameterType.STRING,
      default: "At",
    },
    facing_label: {
      type: ParameterType.STRING,
      default: "Facing",
    },
    point_to_label: {
      type: ParameterType.STRING,
      default: "Point to",
    },
    iti_duration_msec: {
      type: ParameterType.INT,
      default: 0,
    },
  },
  data: {
    opjrd_row: {
      type: ParameterType.BOOL,
    },
  },
} as const;

type Info = typeof info;

interface JrdParameters {
  trialGeometry: TrialGeometry;
  timing: TimingConfig;
  response: ResponseInterfaceConfig;
  stimulusAssets: LoadedStimulusAssets;
  atLabel: string;
  facingLabel: string;
  pointToLabel: string;
  itiDurationMsec: number;
}

function readParameters(trial: TrialType<Info>): JrdParameters {
  return {
    trialGeometry: trial.trial_geometry as unknown as TrialGeometry,
    timing: trial.timing as unknown as TimingConfig,
    response: trial.response as unknown as ResponseInterfaceConfig,
    stimulusAssets:
      (trial.stimulus_assets as unknown as LoadedStimulusAssets | undefined) ??
      EMPTY_STIMULUS_ASSETS,
    atLabel: trial.at_label ?? "At",
    facingLabel: trial.facing_label ?? "Facing",
    pointToLabel: trial.point_to_label ?? "Point to",
    itiDurationMsec: trial.iti_duration_msec ?? 0,
  };
}

function vectorLength(point: Coordinate): number {
  return Math.hypot(point.x, point.y);
}

function hasPointer(point: Coordinate): boolean {
  return vectorLength(point) > JRD_POINTER_MIN_RADIUS;
}

function getUnit(point: Coordinate): Coordinate {
  const length = vectorLength(point);
  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: point.x / length,
    y: point.y / length,
  };
}

function clampVirtualCoordinate(point: Coordinate, maximum: number): Coordinate {
  return {
    x: Math.min(Math.max(point.x, -maximum), maximum),
    y: Math.min(Math.max(point.y, -maximum), maximum),
  };
}

function estimatedAngleFromPointer(pointerPosition: Coordinate): number {
  if (vectorLength(pointerPosition) === 0) {
    return 0;
  }
  return angleFromUpAnticlockwise(pointerPosition);
}

function drawText(
  context: CanvasRenderingContext2D,
  mapping: CanvasMapping,
  text: string,
  position: Coordinate,
  style: TextStyleConfig
): void {
  const point = toCanvas(position, mapping);

  context.save();
  context.fillStyle = style.colour;
  context.font = `${style.sizePx}px ${style.fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, point.x, point.y);
  context.restore();
}

function drawPointerLine(
  context: CanvasRenderingContext2D,
  mapping: CanvasMapping,
  pointerPosition: Coordinate,
  lineEndRadius: number,
  feedbackColour: string,
  feedback: boolean
): void {
  if (!hasPointer(pointerPosition)) {
    return;
  }

  const unit = getUnit(pointerPosition);
  const start = toCanvas(
    {
      x: unit.x * JRD_LINE_START_RADIUS,
      y: unit.y * JRD_LINE_START_RADIUS,
    },
    mapping
  );
  const end = toCanvas(
    {
      x: unit.x * lineEndRadius,
      y: unit.y * lineEndRadius,
    },
    mapping
  );

  context.save();
  context.strokeStyle = feedback ? feedbackColour : "#344054";
  context.lineWidth = feedback ? 4 : 2;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
}

function drawTargetLabel(
  context: CanvasRenderingContext2D,
  mapping: CanvasMapping,
  pointerPosition: Coordinate,
  targetName: string,
  response: ResponseInterfaceConfig,
  stimulusAssets: LoadedStimulusAssets
): void {
  drawObjectStimulus(
    context,
    mapping,
    targetLabelPosition(pointerPosition),
    targetName,
    response,
    stimulusAssets
  );
}

function targetLabelPosition(pointerPosition: Coordinate): Coordinate {
  return hasPointer(pointerPosition)
    ? {
        x: getUnit(pointerPosition).x * JRD_LABEL_RADIUS,
        y: getUnit(pointerPosition).y * JRD_LABEL_RADIUS,
      }
    : { x: 0, y: JRD_LABEL_RADIUS };
}

export class JrdTrialPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: TrialType<Info>): void {
    const parameters = readParameters(trial);
    const { trialGeometry, timing, response, itiDurationMsec } = parameters;
    const canvasDisplay = response.canvas.jrd;
    const canvasWidth = canvasDisplay.widthPx;
    const canvasHeight = canvasDisplay.heightPx;
    const lineEndRadius = response.layoutRadius + 0.2;
    const supportLabelOffsets = response.text.supportLabelOffsets;
    const atLabelExtent =
      Math.hypot(supportLabelOffsets.at.x, supportLabelOffsets.at.y) + 1;
    const facingLabelPosition = offsetCoordinate(
      JRD_DIRECTION_POSITION,
      supportLabelOffsets.facing
    );
    const facingLabelExtent =
      Math.hypot(facingLabelPosition.x, facingLabelPosition.y) + 1;
    const pointToLabelExtent =
      JRD_LABEL_RADIUS +
      Math.hypot(supportLabelOffsets.pointTo.x, supportLabelOffsets.pointTo.y) +
      1;
    const worldExtent = Math.max(
      JRD_WORLD_EXTENT,
      JRD_LABEL_RADIUS + 1,
      lineEndRadius + 1,
      atLabelExtent,
      facingLabelExtent,
      pointToLabelExtent
    );
    const maxVirtualCoordinate = worldExtent - 0.25;
    const mapping = createCanvasMapping(canvasWidth, canvasHeight, worldExtent);

    displayElement.replaceChildren();
    void prepareTrialRunPresentation();

    const { canvas, context, startGateButton, warningElement } =
      getPersistentTrialSurface({
      canvasAriaLabel: "JRD response canvas",
      canvasClassName: "opjrd-trial-canvas",
      canvasDisplay,
      canvasHeight,
      canvasWidth,
      mode: "jrd",
      shellClassName: "opjrd-canvas-shell",
      withWarning: true,
    });

    let animationFrame = 0;
    let gateActive = response.trialStartGate.enabled;
    let trialGateWarningTimeout = 0;
    let trialGateWarningShown = false;
    let startGateMouseDownInside = false;
    let pointerPosition: Coordinate = { x: 0, y: 0 };
    let pointerMoved = false;
    let responseStartMsec = Number.NaN;
    let feedbackStartMsec = Number.NaN;
    let acceptedTrialData: JrdTrialData | null = null;
    let timingOrigin = performance.now();
    const resetTimingOrigin = () => {
      timingOrigin = performance.now();
    };
    const elapsed = () => performance.now() - timingOrigin;
    const phaseRuntime = createTrialPhaseRuntime(
      timing,
      elapsed,
      {
        setTimeout: (callback, delayMsec) => window.setTimeout(callback, delayMsec),
        clearTimeout: (timeoutId) => window.clearTimeout(timeoutId),
      },
      (state) => {
        if (state.phase === "response" && !Number.isFinite(responseStartMsec)) {
          responseStartMsec = elapsed();
          pointerPosition = { x: 0, y: 0 };
        }
      }
    );

    const isResponseOrFeedback = () =>
      phaseRuntime.getState().phase === "response" || acceptedTrialData !== null;

    const drawJrdFrame = () => {
      if (gateActive) {
        prepareTrialCanvas(context, canvas, canvasDisplay);
        drawResponseCircle(context, mapping, response.layoutRadius);
        configureTrialStartGateButton(
          startGateButton,
          canvas,
          mapping,
          response.trialStartGate
        );
        return;
      }

      const phase = phaseRuntime.getState().phase;
      const feedback = acceptedTrialData !== null;
      prepareTrialCanvas(context, canvas, canvasDisplay);
      drawResponseCircle(context, mapping, response.layoutRadius);

      if (phase === "a") {
        drawObjectStimulus(
          context,
          mapping,
          { x: 0, y: 0 },
          trialGeometry.location,
          response,
          parameters.stimulusAssets
        );
        drawText(
          context,
          mapping,
          parameters.atLabel,
          offsetCoordinate({ x: 0, y: 0 }, supportLabelOffsets.at),
          response.text.supportLabels
        );
        return;
      }

      if (phase === "b") {
        drawObjectStimulus(
          context,
          mapping,
          { x: 0, y: 0 },
          trialGeometry.location,
          response,
          parameters.stimulusAssets
        );
        drawObjectStimulus(
          context,
          mapping,
          JRD_DIRECTION_POSITION,
          trialGeometry.direction,
          response,
          parameters.stimulusAssets
        );
        drawText(
          context,
          mapping,
          parameters.facingLabel,
          offsetCoordinate(JRD_DIRECTION_POSITION, supportLabelOffsets.facing),
          response.text.supportLabels
        );
        return;
      }

      drawObjectStimulus(
        context,
        mapping,
        { x: 0, y: 0 },
        trialGeometry.location,
        response,
        parameters.stimulusAssets
      );
      drawObjectStimulus(
        context,
        mapping,
        JRD_DIRECTION_POSITION,
        trialGeometry.direction,
        response,
        parameters.stimulusAssets
      );
      drawTargetLabel(
        context,
        mapping,
        pointerPosition,
        trialGeometry.target,
        response,
        parameters.stimulusAssets
      );
      drawPointerLine(
        context,
        mapping,
        pointerPosition,
        lineEndRadius,
        response.feedback.colour,
        feedback
      );

      if (
        !feedback &&
        Number.isFinite(responseStartMsec) &&
        elapsed() - responseStartMsec <= timing.aToBDelayMsec
      ) {
        drawText(
          context,
          mapping,
          parameters.pointToLabel,
          offsetCoordinate(
            targetLabelPosition(pointerPosition),
            supportLabelOffsets.pointTo
          ),
          response.text.supportLabels
        );
      }
    };

    const cleanupTrialInteraction = () => {
      window.cancelAnimationFrame(animationFrame);
      phaseRuntime.stop();
      document.body.classList.remove("opjrd-trial-active");
      clearGateWarningTimeout();
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("mousedown", onStartGateMouseDown, true);
      document.removeEventListener("mouseup", onStartGateMouseUp, true);
      document.removeEventListener("click", onStartGateDocumentClick, true);
      document.removeEventListener("click", onClick);
      document.removeEventListener("contextmenu", onContextMenu);
      startGateButton.removeEventListener("click", onStartGateClick);
      startGateButton.hidden = true;
      warningElement.textContent = "";
    };

    const finish = () => {
      if (!acceptedTrialData) {
        return;
      }

      const trialData = acceptedTrialData;
      cleanupTrialInteraction();
      drawNeutralTrialSurface(context, canvas, canvasDisplay);

      if (itiDurationMsec > 0) {
        window.setTimeout(
          () => this.jsPsych.finishTrial(trialData),
          itiDurationMsec
        );
        return;
      }

      this.jsPsych.finishTrial(trialData);
    };

    const updatePointerPosition = (event: MouseEvent | PointerEvent) => {
      if (!isResponseOrFeedback()) {
        return;
      }

      const nextPointerPosition = clampVirtualCoordinate(
        fromCanvas(getCanvasPoint(event, canvas), mapping),
        maxVirtualCoordinate
      );

      if (
        nextPointerPosition.x !== pointerPosition.x ||
        nextPointerPosition.y !== pointerPosition.y
      ) {
        pointerMoved = true;
      }
      pointerPosition = nextPointerPosition;
    };

    const onPointerMove = (event: PointerEvent) => {
      updatePointerPosition(event);
    };

    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      updatePointerPosition(event);
      if (phaseRuntime.getState().phase !== "response" || acceptedTrialData) {
        return;
      }
      if (!hasPointer(pointerPosition)) {
        return;
      }

      const phaseState = phaseRuntime.getState();
      const responseFinalisationMsec = elapsed();
      const acceptedPointerPosition = { ...pointerPosition };
      const events: TrialTimingEvents = {
        a_onset_msec: phaseState.aOnsetMsec,
        b_onset_msec: phaseState.bOnsetMsec,
        c_onset_msec: phaseState.cOnsetMsec,
        response_finalisation_msec: responseFinalisationMsec,
      };

      feedbackStartMsec = responseFinalisationMsec;
      acceptedTrialData = buildJrdTrialData(
        trialGeometry,
        events,
        timing.latencyStartEvent,
        {
          estimatedAngle: estimatedAngleFromPointer(acceptedPointerPosition),
          pointerPosition: acceptedPointerPosition,
          pointerMoved,
          finalisationMethod: "click",
          trialStartGateEnabled: response.trialStartGate.enabled,
          trialGateWarningShown,
        }
      );
      if (response.feedback.durationMsec === 0) {
        finish();
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const clearGateWarningTimeout = () => {
      if (trialGateWarningTimeout !== 0) {
        window.clearTimeout(trialGateWarningTimeout);
        trialGateWarningTimeout = 0;
      }
    };

    const startTrialPhases = (aOnsetMsec: number) => {
      gateActive = false;
      startGateButton.hidden = true;
      clearGateWarningTimeout();
      warningElement.textContent = "";
      phaseRuntime.start(aOnsetMsec);
    };

    const onStartGateClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!gateActive) {
        return;
      }

      startTrialPhases(elapsed());
    };

    const onStartGateMouseDown = (event: MouseEvent) => {
      startGateMouseDownInside =
        event.button === 0 &&
        gateActive &&
        !startGateButton.hidden &&
        isClientPointInsideElement(event, startGateButton);
    };

    const onStartGateMouseUp = (event: MouseEvent) => {
      const shouldActivate =
        startGateMouseDownInside &&
        event.button === 0 &&
        gateActive &&
        !startGateButton.hidden &&
        isClientPointInsideElement(event, startGateButton);
      startGateMouseDownInside = false;

      if (!shouldActivate) {
        return;
      }

      onStartGateClick(event);
    };

    const onStartGateDocumentClick = (event: MouseEvent) => {
      if (
        !gateActive ||
        startGateButton.hidden ||
        !isClientPointInsideElement(event, startGateButton)
      ) {
        return;
      }

      onStartGateClick(event);
    };

    const scheduleGateWarning = () => {
      if (!response.trialStartGate.enabled || !response.trialStartGate.warningEnabled) {
        return;
      }

      clearGateWarningTimeout();
      trialGateWarningTimeout = window.setTimeout(() => {
        if (!gateActive) {
          return;
        }

        trialGateWarningShown = true;
        warningElement.textContent = formatTrialStartGateWarning(
          response.trialStartGate.warningMessage,
          response.trialStartGate.label
        );
      }, response.trialStartGate.warningDelayMsec);
    };

    const loop = () => {
      if (
        acceptedTrialData &&
        elapsed() - feedbackStartMsec >= response.feedback.durationMsec
      ) {
        finish();
        return;
      }

      drawJrdFrame();
      animationFrame = window.requestAnimationFrame(loop);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("mousedown", onStartGateMouseDown, true);
    document.addEventListener("mouseup", onStartGateMouseUp, true);
    document.addEventListener("click", onStartGateDocumentClick, true);
    document.addEventListener("click", onClick);
    document.addEventListener("contextmenu", onContextMenu);
    startGateButton.addEventListener("click", onStartGateClick);
    if (response.trialStartGate.enabled) {
      configureTrialStartGateButton(
        startGateButton,
        canvas,
        mapping,
        response.trialStartGate
      );
      startGateButton.hidden = false;
      resetTimingOrigin();
      scheduleGateWarning();
    } else {
      resetTimingOrigin();
      startTrialPhases(0);
    }
    animationFrame = window.requestAnimationFrame(loop);
  }
}

export default JrdTrialPlugin;
