import {
  angleFromUpAnticlockwise,
  angularErrorAnticlockwise,
  radiansToDegrees,
} from "./angles";
import { vectorLength } from "./geometry";
import type { Coordinate } from "./types";

export interface ObjectPlacementScore {
  true_x: number;
  true_y: number;
  placed_x: number;
  placed_y: number;
  true_angle: number;
  true_angle_deg: number;
  placed_angle: number;
  placed_angle_deg: number;
  angular_error_signed: number;
  angular_error_signed_deg: number;
  angular_error_absolute: number;
  angular_error_absolute_deg: number;
  true_distance: number;
  placed_distance: number;
  distance_error_signed: number;
  distance_error_absolute: number;
  position_error_euclidean: number;
}

export interface JrdScore {
  true_angle: number;
  true_angle_deg: number;
  estimated_angle: number;
  estimated_angle_deg: number;
  angular_error_signed: number;
  angular_error_signed_deg: number;
  angular_error_absolute: number;
  angular_error_absolute_deg: number;
}

export function scoreObjectPlacement(
  truePosition: Coordinate,
  placedPosition: Coordinate
): ObjectPlacementScore {
  const trueAngle = angleFromUpAnticlockwise(truePosition);
  const placedAngle = angleFromUpAnticlockwise(placedPosition);
  const angularErrorSigned = angularErrorAnticlockwise(trueAngle, placedAngle);
  const trueDistance = vectorLength(truePosition);
  const placedDistance = vectorLength(placedPosition);
  const distanceErrorSigned = placedDistance - trueDistance;
  const dx = placedPosition.x - truePosition.x;
  const dy = placedPosition.y - truePosition.y;

  return {
    true_x: truePosition.x,
    true_y: truePosition.y,
    placed_x: placedPosition.x,
    placed_y: placedPosition.y,
    true_angle: trueAngle,
    true_angle_deg: radiansToDegrees(trueAngle),
    placed_angle: placedAngle,
    placed_angle_deg: radiansToDegrees(placedAngle),
    angular_error_signed: angularErrorSigned,
    angular_error_signed_deg: radiansToDegrees(angularErrorSigned),
    angular_error_absolute: Math.abs(angularErrorSigned),
    angular_error_absolute_deg: Math.abs(radiansToDegrees(angularErrorSigned)),
    true_distance: trueDistance,
    placed_distance: placedDistance,
    distance_error_signed: distanceErrorSigned,
    distance_error_absolute: Math.abs(distanceErrorSigned),
    position_error_euclidean: Math.hypot(dx, dy),
  };
}

export function scoreJrd(trueAngle: number, estimatedAngle: number): JrdScore {
  const angularErrorSigned = angularErrorAnticlockwise(trueAngle, estimatedAngle);

  return {
    true_angle: trueAngle,
    true_angle_deg: radiansToDegrees(trueAngle),
    estimated_angle: estimatedAngle,
    estimated_angle_deg: radiansToDegrees(estimatedAngle),
    angular_error_signed: angularErrorSigned,
    angular_error_signed_deg: radiansToDegrees(angularErrorSigned),
    angular_error_absolute: Math.abs(angularErrorSigned),
    angular_error_absolute_deg: Math.abs(radiansToDegrees(angularErrorSigned)),
  };
}
