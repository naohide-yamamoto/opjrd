import type { Coordinate } from "./types";

export const TWO_PI = 2 * Math.PI;

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function wrapToTwoPi(angle: number): number {
  return positiveModulo(angle, TWO_PI);
}

export function wrapToPi(angle: number): number {
  const wrapped = positiveModulo(angle + Math.PI, TWO_PI) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

export function angleFromUpAnticlockwise(point: Coordinate): number {
  return wrapToPi(Math.atan2(point.y, point.x) - Math.PI / 2);
}

export function angularErrorAnticlockwise(
  trueAngle: number,
  estimatedAngle: number
): number {
  if (!Number.isFinite(trueAngle) || !Number.isFinite(estimatedAngle)) {
    return Number.NaN;
  }

  return wrapToPi(estimatedAngle - trueAngle);
}
