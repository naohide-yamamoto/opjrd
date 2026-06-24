import type {
  CanvasDisplayConfig,
  Coordinate,
  ResponseInterfaceConfig,
  TrialStartGateConfig,
  TaskMode,
  TextStyleConfig,
} from "../core/types";
import {
  fromCanvas,
  toCanvas,
  type CanvasMapping,
  type CanvasPoint,
} from "./canvas-geometry";
import {
  enterTrialFullscreen,
  exitTrialFullscreen as exitRuntimeTrialFullscreen,
} from "../runtime/fullscreen";
import type { LoadedStimulusAssets } from "./stimulus-assets";

export interface PersistentTrialSurface {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  mode: TaskMode;
  shell: HTMLElement;
  startGateButton: HTMLButtonElement;
  warningElement: HTMLParagraphElement;
}

interface PersistentTrialSurfaceOptions {
  canvasAriaLabel: string;
  canvasClassName: string;
  canvasDisplay: CanvasDisplayConfig;
  canvasHeight: number;
  canvasWidth: number;
  mode: TaskMode;
  shellClassName: string;
  withWarning: boolean;
}

let persistentTrialSurface: PersistentTrialSurface | null = null;

function configurePersistentTrialSurface(
  surface: PersistentTrialSurface,
  options: PersistentTrialSurfaceOptions
): void {
  surface.canvas.width = options.canvasWidth;
  surface.canvas.height = options.canvasHeight;
  surface.canvas.className = [
    options.canvasClassName,
    `opjrd-trial-canvas-shape-${options.canvasDisplay.shape}`,
    options.canvasDisplay.visible ? "" : "opjrd-trial-canvas-surface-hidden",
  ]
    .filter(Boolean)
    .join(" ");
  surface.canvas.setAttribute("aria-label", options.canvasAriaLabel);
  surface.shell.className =
    `opjrd-persistent-trial-surface ${options.shellClassName}`;
  surface.shell.style.setProperty(
    "--opjrd-configured-trial-canvas-width",
    `${options.canvasWidth}px`
  );
  surface.shell.style.setProperty(
    "--opjrd-configured-trial-canvas-height",
    `${options.canvasHeight}px`
  );
  surface.shell.style.setProperty(
    "--opjrd-trial-canvas-aspect-ratio",
    `${options.canvasWidth} / ${options.canvasHeight}`
  );
  surface.shell.style.setProperty(
    "--opjrd-configured-trial-canvas-half-height",
    `${options.canvasHeight / 2}px`
  );
  surface.warningElement.textContent = "";
  surface.warningElement.hidden = !options.withWarning;
  surface.startGateButton.hidden = true;

  if (options.withWarning && !surface.warningElement.parentElement) {
    surface.shell.append(surface.warningElement);
  }
  if (!options.withWarning) {
    surface.warningElement.remove();
  }
}

export function getPersistentTrialSurface(
  options: PersistentTrialSurfaceOptions
): PersistentTrialSurface {
  if (persistentTrialSurface && persistentTrialSurface.mode !== options.mode) {
    removePersistentTrialSurface();
  }

  if (!persistentTrialSurface) {
    const shell = document.createElement("section");
    const canvas = document.createElement("canvas");
    const startGateButton = document.createElement("button");
    const warningElement = document.createElement("p");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("OPJRD could not create the trial canvas.");
    }

    startGateButton.className = "opjrd-trial-start-gate";
    startGateButton.type = "button";
    startGateButton.hidden = true;
    warningElement.className = "opjrd-trial-warning";
    warningElement.setAttribute("role", "alert");
    shell.append(canvas, startGateButton);
    document.body.append(shell);

    persistentTrialSurface = {
      canvas,
      context,
      mode: options.mode,
      shell,
      startGateButton,
      warningElement,
    };
  }

  configurePersistentTrialSurface(persistentTrialSurface, options);
  return persistentTrialSurface;
}

export function removePersistentTrialSurface(): void {
  persistentTrialSurface?.shell.remove();
  persistentTrialSurface = null;
}

export async function prepareTrialRunPresentation(): Promise<void> {
  document.body.classList.add("opjrd-trial-active");
  await enterTrialFullscreen();
}

export function cleanupTrialRunPresentation(): void {
  document.body.classList.remove("opjrd-trial-active");
  removePersistentTrialSurface();
}

export function exitTrialFullscreen(): void {
  exitRuntimeTrialFullscreen();
}

export function clampCanvasPoint(
  point: CanvasPoint,
  canvasWidth: number,
  canvasHeight: number
): CanvasPoint {
  return {
    x: Math.min(Math.max(point.x, 0), canvasWidth),
    y: Math.min(Math.max(point.y, 0), canvasHeight),
  };
}

export function clampCoordinateToCanvas(
  coordinate: Coordinate,
  mapping: CanvasMapping
): Coordinate {
  return fromCanvas(
    clampCanvasPoint(
      toCanvas(coordinate, mapping),
      mapping.canvasWidth,
      mapping.canvasHeight
    ),
    mapping
  );
}

export function clampCoordinateToCircle(
  coordinate: Coordinate,
  radius: number
): Coordinate {
  const distance = Math.hypot(coordinate.x, coordinate.y);

  if (distance === 0 || distance <= radius) {
    return coordinate;
  }

  const scale = radius / distance;
  return {
    x: coordinate.x * scale,
    y: coordinate.y * scale,
  };
}

export function clampCoordinateToCanvasShape(
  coordinate: Coordinate,
  mapping: CanvasMapping,
  canvasDisplay: CanvasDisplayConfig
): Coordinate {
  return canvasDisplay.shape === "circle"
    ? clampCoordinateToCircle(coordinate, mapping.worldExtent)
    : clampCoordinateToCanvas(coordinate, mapping);
}

export function prepareTrialCanvas(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  canvasDisplay: CanvasDisplayConfig
): void {
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!canvasDisplay.visible) {
    return;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

export function drawResponseCircle(
  context: CanvasRenderingContext2D,
  mapping: CanvasMapping,
  radius: number
): void {
  const centre = toCanvas({ x: 0, y: 0 }, mapping);
  context.strokeStyle = "#8a96a8";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(centre.x, centre.y, radius * mapping.pixelsPerUnit, 0, Math.PI * 2);
  context.stroke();
}

export function drawNeutralTrialSurface(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  canvasDisplay: CanvasDisplayConfig
): void {
  prepareTrialCanvas(context, canvas, canvasDisplay);
}

export function drawObjectText(
  context: CanvasRenderingContext2D,
  mapping: CanvasMapping,
  position: Coordinate,
  label: string,
  style: TextStyleConfig
): void {
  const point = toCanvas(position, mapping);

  context.save();
  context.fillStyle = style.colour;
  context.font = `${style.sizePx}px ${style.fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, point.x, point.y);
  context.restore();
}

function imageDrawSize(
  image: HTMLImageElement,
  maximumSizePx: number
): { height: number; width: number } {
  const width = image.naturalWidth || maximumSizePx;
  const height = image.naturalHeight || maximumSizePx;
  const scale = maximumSizePx / Math.max(width, height);

  return {
    width: width * scale,
    height: height * scale,
  };
}

export function drawObjectStimulus(
  context: CanvasRenderingContext2D,
  mapping: CanvasMapping,
  position: Coordinate,
  label: string,
  response: ResponseInterfaceConfig,
  stimulusAssets: LoadedStimulusAssets,
  options: { feedbackColour?: string } = {}
): void {
  const image =
    response.stimuli.mode === "image" ? stimulusAssets.images[label] : undefined;

  if (image) {
    const point = toCanvas(position, mapping);
    const { height, width } = imageDrawSize(image, response.stimuli.imageSizePx);

    context.save();
    context.drawImage(
      image,
      point.x - width / 2,
      point.y - height / 2,
      width,
      height
    );
    if (options.feedbackColour) {
      context.strokeStyle = options.feedbackColour;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(
        point.x,
        point.y,
        Math.max(width, height) / 2 + 6,
        0,
        Math.PI * 2
      );
      context.stroke();
    }
    context.restore();
    return;
  }

  drawObjectText(
    context,
    mapping,
    position,
    label,
    options.feedbackColour
      ? { ...response.text.objectLabels, colour: options.feedbackColour }
      : response.text.objectLabels
  );
}

export function configureTrialStartGateButton(
  button: HTMLButtonElement,
  canvas: HTMLCanvasElement,
  mapping: CanvasMapping,
  config: TrialStartGateConfig
): void {
  const canvasPoint = toCanvas(config.position, mapping);
  const canvasRect = canvas.getBoundingClientRect();
  const shellRect = button.parentElement?.getBoundingClientRect() ?? {
    left: 0,
    top: 0,
  };
  const scaleX = canvasRect.width > 0 ? canvasRect.width / canvas.width : 1;
  const scaleY = canvasRect.height > 0 ? canvasRect.height / canvas.height : 1;

  button.textContent = config.label;
  button.style.left = `${
    canvasRect.left - shellRect.left + canvasPoint.x * scaleX
  }px`;
  button.style.top = `${
    canvasRect.top - shellRect.top + canvasPoint.y * scaleY
  }px`;

  if (config.widthPx === null) {
    button.style.removeProperty("width");
  } else {
    button.style.width = `${config.widthPx}px`;
  }

  if (config.heightPx === null) {
    button.style.removeProperty("height");
  } else {
    button.style.height = `${config.heightPx}px`;
  }
}

export function formatTrialStartGateWarning(
  message: string,
  label: string
): string {
  return message.replaceAll("{label}", label);
}

export function isClientPointInsideElement(
  event: MouseEvent,
  element: HTMLElement
): boolean {
  const rect = element.getBoundingClientRect();

  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}
