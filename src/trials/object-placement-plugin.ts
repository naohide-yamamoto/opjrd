import {
  JsPsych,
  type JsPsychPlugin,
  ParameterType,
  type TrialType,
} from "jspsych";
import type {
  Coordinate,
  ResponseInterfaceConfig,
  TextStyleConfig,
  TimingConfig,
  TrialGeometry,
  TrialTimingEvents,
} from "../core/types";
import {
  calculateWorldExtent,
  type CanvasMapping,
  createCanvasMapping,
  formatMoveRequiredWarning,
  fromCanvas,
  getCanvasPoint,
  isPointNearCoordinate,
  offsetCoordinate,
  toCanvas,
} from "./canvas-geometry";
import {
  buildObjectPlacementTrialData,
  type ObjectPlacementTrialData,
} from "./trial-data";
import {
  clampCoordinateToCanvasShape,
  configureTrialStartGateButton,
  drawNeutralTrialSurface,
  drawObjectStimulus,
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

const info = {
  name: "opjrd-object-placement",
  version: "0.1.1",
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
    place_label: {
      type: ParameterType.STRING,
      default: "Place",
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

interface ObjectPlacementParameters {
  trialGeometry: TrialGeometry;
  timing: TimingConfig;
  response: ResponseInterfaceConfig;
  stimulusAssets: LoadedStimulusAssets;
  atLabel: string;
  facingLabel: string;
  placeLabel: string;
  itiDurationMsec: number;
}

function readParameters(trial: TrialType<Info>): ObjectPlacementParameters {
  return {
    trialGeometry: trial.trial_geometry as unknown as TrialGeometry,
    timing: trial.timing as unknown as TimingConfig,
    response: trial.response as unknown as ResponseInterfaceConfig,
    stimulusAssets:
      (trial.stimulus_assets as unknown as LoadedStimulusAssets | undefined) ??
      EMPTY_STIMULUS_ASSETS,
    atLabel: trial.at_label ?? "At",
    facingLabel: trial.facing_label ?? "Facing",
    placeLabel: trial.place_label ?? "Place",
    itiDurationMsec: trial.iti_duration_msec ?? 0,
  };
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

export class ObjectPlacementTrialPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: TrialType<Info>): void {
    const parameters = readParameters(trial);
    const { trialGeometry, timing, response, itiDurationMsec } = parameters;
    const canvasDisplay = response.canvas.objectPlacement;
    const canvasWidth = canvasDisplay.widthPx;
    const canvasHeight = canvasDisplay.heightPx;
    const finalisationKey = response.objectPlacement.finalisationKey;
    const supportLabelOffsets = response.text.supportLabelOffsets;
    const atLabelPosition = offsetCoordinate({ x: 0, y: 0 }, supportLabelOffsets.at);
    const facingLabelPosition = offsetCoordinate(
      { x: 0, y: response.abDistance },
      supportLabelOffsets.facing
    );
    const initialPlaceLabelPosition = offsetCoordinate(
      response.objectPlacement.cInitialPosition,
      supportLabelOffsets.place
    );
    const worldExtent = Math.max(
      calculateWorldExtent(trialGeometry, response),
      Math.hypot(atLabelPosition.x, atLabelPosition.y) + 1,
      Math.hypot(facingLabelPosition.x, facingLabelPosition.y) + 1,
      Math.hypot(initialPlaceLabelPosition.x, initialPlaceLabelPosition.y) + 1
    );
    const mapping = createCanvasMapping(canvasWidth, canvasHeight, worldExtent);

    displayElement.replaceChildren();
    void prepareTrialRunPresentation();

    const { canvas, context, startGateButton, warningElement } =
      getPersistentTrialSurface({
      canvasAriaLabel: "Object-placement response canvas",
      canvasClassName: "opjrd-trial-canvas opjrd-object-placement-canvas",
      canvasDisplay,
      canvasHeight,
      canvasWidth,
      mode: "object_placement",
      shellClassName: "opjrd-canvas-shell opjrd-object-placement-shell",
      withWarning: true,
    });

    let animationFrame = 0;
    let gateActive = response.trialStartGate.enabled;
    let trialGateWarningTimeout = 0;
    let trialGateWarningShown = false;
    let startGateMouseDownInside = false;
    let placedPosition: Coordinate = {
      ...response.objectPlacement.cInitialPosition,
    };
    let cMoved = false;
    let movementCount = 0;
    let finalisationAttempts = 0;
    let blockedFinalisationAttempts = 0;
    let moveRequiredWarningShown = false;
    let draggingC = false;
    let dragMovedThisPointer = false;
    let activeDragPointerId: number | null = null;
    let responseStartMsec = Number.NaN;
    let feedbackStartMsec = Number.NaN;
    let acceptedTrialData: ObjectPlacementTrialData | null = null;
    let trialCompletionStarted = false;
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
        }
      }
    );

    const draw = () => {
      if (gateActive) {
        prepareTrialCanvas(context, canvas, canvasDisplay);
        configureTrialStartGateButton(
          startGateButton,
          canvas,
          mapping,
          response.trialStartGate
        );
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }

      const phase = phaseRuntime.getState().phase;
      const feedback = acceptedTrialData !== null;
      prepareTrialCanvas(context, canvas, canvasDisplay);

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
        animationFrame = window.requestAnimationFrame(draw);
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
        { x: 0, y: response.abDistance },
        trialGeometry.direction,
        response,
        parameters.stimulusAssets
      );

      if (phase === "b") {
        drawText(
          context,
          mapping,
          parameters.facingLabel,
          offsetCoordinate(
            { x: 0, y: response.abDistance },
            supportLabelOffsets.facing
          ),
          response.text.supportLabels
        );
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }

      if (phase === "response") {
        drawObjectStimulus(
          context,
          mapping,
          placedPosition,
          trialGeometry.target,
          response,
          parameters.stimulusAssets,
          feedback ? { feedbackColour: response.feedback.colour } : undefined
        );
        if (
          !feedback &&
          Number.isFinite(responseStartMsec) &&
          elapsed() - responseStartMsec <= timing.aToBDelayMsec
        ) {
          drawText(
            context,
            mapping,
            parameters.placeLabel,
            offsetCoordinate(placedPosition, supportLabelOffsets.place),
            response.text.supportLabels
          );
        }
      }

      if (
        feedback &&
        elapsed() - feedbackStartMsec >= response.feedback.durationMsec
      ) {
        completeTrial();
        return;
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    const pointerCoordinateFromEvent = (event: PointerEvent): Coordinate =>
      clampCoordinateToCanvasShape(
        fromCanvas(getCanvasPoint(event, canvas), mapping),
        mapping,
        canvasDisplay
      );

    const releaseDragPointer = (pointerId: number | null) => {
      try {
        if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
          canvas.releasePointerCapture(pointerId);
        }
      } catch {
        // A lost browser capture should not interrupt trial cleanup.
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (
        phaseRuntime.getState().phase !== "response" ||
        !draggingC ||
        event.pointerId !== activeDragPointerId
      ) {
        return;
      }

      event.preventDefault();
      if (event.pointerType === "mouse" && (event.buttons & 1) !== 1) {
        releaseDragPointer(activeDragPointerId);
        draggingC = false;
        dragMovedThisPointer = false;
        activeDragPointerId = null;
        return;
      }

      placedPosition = pointerCoordinateFromEvent(event);
      if (!dragMovedThisPointer) {
        movementCount += 1;
        dragMovedThisPointer = true;
      }
      cMoved = true;
      warningElement.textContent = "";
    };

    const captureDragPointer = (pointerId: number) => {
      try {
        if (!canvas.hasPointerCapture(pointerId)) {
          canvas.setPointerCapture(pointerId);
        }
      } catch {
        // Some browser/fullscreen edge cases can reject capture; document-level
        // listeners still keep the trial usable.
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (phaseRuntime.getState().phase !== "response") {
        return;
      }

      event.preventDefault();
      if (event.button !== 0 || !event.isPrimary) {
        return;
      }

      const canvasPoint = getCanvasPoint(event, canvas);
      const grabRadius =
        response.stimuli.mode === "image" &&
        parameters.stimulusAssets.images[trialGeometry.target]
          ? Math.max(30, response.stimuli.imageSizePx / 2)
          : 30;
      if (!isPointNearCoordinate(canvasPoint, placedPosition, mapping, grabRadius)) {
        return;
      }

      draggingC = true;
      dragMovedThisPointer = false;
      activeDragPointerId = event.pointerId;
      captureDragPointer(event.pointerId);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (
        activeDragPointerId !== null &&
        event.pointerId !== activeDragPointerId
      ) {
        return;
      }

      if (draggingC) {
        event.preventDefault();
      }
      releaseDragPointer(activeDragPointerId);
      draggingC = false;
      dragMovedThisPointer = false;
      activeDragPointerId = null;
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

    const cleanupTrialInteraction = () => {
      phaseRuntime.stop();
      clearGateWarningTimeout();
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onStartGateMouseDown, true);
      document.removeEventListener("mouseup", onStartGateMouseUp, true);
      document.removeEventListener("click", onStartGateDocumentClick, true);
      startGateButton.removeEventListener("click", onStartGateClick);
      startGateButton.hidden = true;
      warningElement.textContent = "";
    };

    const completeTrial = () => {
      if (!acceptedTrialData || trialCompletionStarted) {
        return;
      }

      const trialData = acceptedTrialData;
      trialCompletionStarted = true;
      window.cancelAnimationFrame(animationFrame);
      document.body.classList.remove("opjrd-trial-active");
      drawNeutralTrialSurface(context, canvas, canvasDisplay);

      if (itiDurationMsec > 0) {
        window.setTimeout(() => this.jsPsych.finishTrial(trialData), itiDurationMsec);
        return;
      }

      this.jsPsych.finishTrial(trialData);
    };

    const finish = () => {
      if (acceptedTrialData) {
        return;
      }

      const phaseState = phaseRuntime.getState();
      const events: TrialTimingEvents = {
        a_onset_msec: phaseState.aOnsetMsec,
        b_onset_msec: phaseState.bOnsetMsec,
        c_onset_msec: phaseState.cOnsetMsec,
        response_finalisation_msec: elapsed(),
      };
      const trialData = buildObjectPlacementTrialData(
        trialGeometry,
        events,
        timing.latencyStartEvent,
        {
          placedPosition,
          cInitialPosition: response.objectPlacement.cInitialPosition,
          cMoved,
          movementCount,
          finalisationAttempts,
          blockedFinalisationAttempts,
          finalisationKey,
          moveRequiredWarningShown,
          trialStartGateEnabled: response.trialStartGate.enabled,
          trialGateWarningShown,
        }
      );

      cleanupTrialInteraction();
      acceptedTrialData = trialData;
      feedbackStartMsec = elapsed();
      if (response.feedback.durationMsec === 0) {
        completeTrial();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== finalisationKey) {
        return;
      }

      event.preventDefault();
      if (phaseRuntime.getState().phase !== "response") {
        return;
      }

      finalisationAttempts += 1;
      if (response.objectPlacement.requireMoveBeforeFinalise && !cMoved) {
        blockedFinalisationAttempts += 1;
        moveRequiredWarningShown = true;
        warningElement.textContent = formatMoveRequiredWarning(
          response.objectPlacement.moveRequiredWarningMessage,
          finalisationKey
        );
        return;
      }

      finish();
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onStartGateMouseDown, true);
    document.addEventListener("mouseup", onStartGateMouseUp, true);
    document.addEventListener("click", onStartGateDocumentClick, true);
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
    animationFrame = window.requestAnimationFrame(draw);
  }
}

export default ObjectPlacementTrialPlugin;
