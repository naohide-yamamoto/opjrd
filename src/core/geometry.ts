import {
  angleFromUpAnticlockwise,
  radiansToDegrees,
  wrapToTwoPi,
} from "./angles";
import type {
  Coordinate,
  LocationIndex,
  TrialGeometry,
  TrialReference,
} from "./types";

const MIN_VECTOR_LENGTH = 1e-9;

export function vectorBetween(from: Coordinate, to: Coordinate): Coordinate {
  return {
    x: to.x - from.x,
    y: to.y - from.y,
  };
}

export function vectorLength(vector: Coordinate): number {
  return Math.hypot(vector.x, vector.y);
}

export function dot(a: Coordinate, b: Coordinate): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Coordinate, b: Coordinate): number {
  return a.x * b.y - a.y * b.x;
}

export function assertFiniteCoordinate(
  value: Coordinate,
  fieldName: string
): void {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`Config error: ${fieldName} must contain finite x and y values.`);
  }
}

export function normaliseVector(vector: Coordinate, fieldName: string): Coordinate {
  assertFiniteCoordinate(vector, fieldName);
  const length = vectorLength(vector);

  if (length <= MIN_VECTOR_LENGTH) {
    throw new Error(`${fieldName} must not be a zero-length vector.`);
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

export function headingRelativeToZero(
  from: Coordinate,
  to: Coordinate,
  zeroDirection: Coordinate
): number {
  const zeroUnit = normaliseVector(zeroDirection, "zeroDirection");
  const headingVector = vectorBetween(from, to);
  const headingUnit = normaliseVector(headingVector, "heading vector");

  return wrapToTwoPi(Math.atan2(cross(zeroUnit, headingUnit), dot(zeroUnit, headingUnit)));
}

export interface CanonicalTransformResult {
  truePosition: Coordinate;
  trueAngle: number;
  trueDistance: number;
  scale: number;
}

export function calculateCanonicalTransform(
  base: Coordinate,
  direction: Coordinate,
  target: Coordinate,
  responseAbDistance: number
): CanonicalTransformResult {
  if (!Number.isFinite(responseAbDistance) || responseAbDistance <= 0) {
    throw new Error("responseAbDistance must be a positive number.");
  }

  const facingVector = vectorBetween(base, direction);
  const facingDistance = vectorLength(facingVector);

  if (facingDistance <= MIN_VECTOR_LENGTH) {
    throw new Error("Trial direction object must not be at the same location as the base object.");
  }

  const upUnit = {
    x: facingVector.x / facingDistance,
    y: facingVector.y / facingDistance,
  };
  const rightUnit = {
    x: upUnit.y,
    y: -upUnit.x,
  };
  const targetVector = vectorBetween(base, target);
  const scale = responseAbDistance / facingDistance;
  const truePosition = {
    x: dot(targetVector, rightUnit) * scale,
    y: dot(targetVector, upUnit) * scale,
  };

  return {
    truePosition,
    trueAngle: angleFromUpAnticlockwise(truePosition),
    trueDistance: vectorLength(truePosition),
    scale,
  };
}

export function resolveTrialLocations(
  trial: TrialReference,
  locations: LocationIndex
): { base: Coordinate; direction: Coordinate; target: Coordinate } {
  const base = locations[trial.location];
  const direction = locations[trial.direction];
  const target = locations[trial.target];

  if (!base || !direction || !target) {
    throw new Error(
      `Missing location reference in trial ${trial.trialId}: ${trial.location}, ${trial.direction}, ${trial.target}`
    );
  }

  return { base, direction, target };
}

export function buildTrialGeometry(
  trial: TrialReference,
  locations: LocationIndex,
  zeroDirection: Coordinate,
  responseAbDistance: number
): TrialGeometry {
  const { base, direction, target } = resolveTrialLocations(trial, locations);
  const transform = calculateCanonicalTransform(
    base,
    direction,
    target,
    responseAbDistance
  );
  const imaginedHeading = headingRelativeToZero(base, direction, zeroDirection);

  return {
    trialId: trial.trialId,
    location: trial.location,
    direction: trial.direction,
    target: trial.target,
    truePosition: transform.truePosition,
    trueAngle: transform.trueAngle,
    trueAngleDeg: radiansToDegrees(transform.trueAngle),
    trueDistance: transform.trueDistance,
    imaginedHeading,
    imaginedHeadingDeg: radiansToDegrees(imaginedHeading),
  };
}
