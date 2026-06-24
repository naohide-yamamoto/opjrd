import type { Coordinate, ResponseInterfaceConfig, TrialGeometry } from "../core/types";

export interface CanvasMapping {
  canvasWidth: number;
  canvasHeight: number;
  centreX: number;
  centreY: number;
  pixelsPerUnit: number;
  worldExtent: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export function calculateWorldExtent(
  trial: TrialGeometry,
  response: ResponseInterfaceConfig
): number {
  const cInitial = response.objectPlacement.cInitialPosition;
  const coordinates = [trial.truePosition, cInitial, { x: 0, y: response.abDistance }];
  const maximumCoordinate = Math.max(
    response.layoutRadius,
    ...coordinates.map((coordinate) => Math.hypot(coordinate.x, coordinate.y))
  );

  return maximumCoordinate + 1;
}

export function createCanvasMapping(
  canvasWidth: number,
  canvasHeight: number,
  worldExtent: number
): CanvasMapping {
  return {
    canvasWidth,
    canvasHeight,
    centreX: canvasWidth / 2,
    centreY: canvasHeight / 2,
    pixelsPerUnit: Math.min(canvasWidth, canvasHeight) / (worldExtent * 2),
    worldExtent,
  };
}

export function toCanvas(point: Coordinate, mapping: CanvasMapping): CanvasPoint {
  return {
    x: mapping.centreX + point.x * mapping.pixelsPerUnit,
    y: mapping.centreY - point.y * mapping.pixelsPerUnit,
  };
}

export function offsetCoordinate(
  point: Coordinate,
  offset: Coordinate
): Coordinate {
  return {
    x: point.x + offset.x,
    y: point.y + offset.y,
  };
}

export function fromCanvas(point: CanvasPoint, mapping: CanvasMapping): Coordinate {
  return {
    x: (point.x - mapping.centreX) / mapping.pixelsPerUnit,
    y: (mapping.centreY - point.y) / mapping.pixelsPerUnit,
  };
}

export function getCanvasPoint(
  event: PointerEvent | MouseEvent,
  canvas: HTMLCanvasElement
): CanvasPoint {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function formatFinalisationKeyLabel(key: string): string {
  if (key === " " || key.toLowerCase() === "space") {
    return "space bar";
  }
  if (key.length === 1) {
    return key;
  }
  return key;
}

export function formatMoveRequiredWarning(
  message: string,
  finalisationKey: string
): string {
  return message.replaceAll(
    "{finalisationKey}",
    formatFinalisationKeyLabel(finalisationKey)
  );
}

export function isPointNearCoordinate(
  canvasPoint: CanvasPoint,
  coordinate: Coordinate,
  mapping: CanvasMapping,
  radiusPixels: number
): boolean {
  const target = toCanvas(coordinate, mapping);
  return Math.hypot(canvasPoint.x - target.x, canvasPoint.y - target.y) <= radiusPixels;
}
