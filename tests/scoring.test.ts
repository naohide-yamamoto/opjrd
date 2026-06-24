import { describe, expect, it } from "vitest";
import { degreesToRadians } from "../src/core/angles";
import { scoreJrd, scoreObjectPlacement } from "../src/core/scoring";

const precision = 8;

describe("object-placement scoring", () => {
  it("returns zero errors for an exact placement", () => {
    const score = scoreObjectPlacement({ x: -4, y: 4 }, { x: -4, y: 4 });

    expect(score.angular_error_signed).toBeCloseTo(0, precision);
    expect(score.distance_error_signed).toBeCloseTo(0, precision);
    expect(score.position_error_euclidean).toBeCloseTo(0, precision);
  });

  it("separates angular, distance, and Euclidean position errors", () => {
    const score = scoreObjectPlacement({ x: 0, y: 4 }, { x: 0, y: 5 });

    expect(score.angular_error_signed).toBeCloseTo(0, precision);
    expect(score.distance_error_signed).toBeCloseTo(1, precision);
    expect(score.position_error_euclidean).toBeCloseTo(1, precision);
  });
});

describe("JRD scoring", () => {
  it("uses anticlockwise-positive signed angular error", () => {
    const score = scoreJrd(degreesToRadians(0), degreesToRadians(90));

    expect(score.angular_error_signed_deg).toBeCloseTo(90, precision);
    expect(score.angular_error_absolute_deg).toBeCloseTo(90, precision);
  });

  it("wraps signed angular error to (-180, 180]", () => {
    const score = scoreJrd(degreesToRadians(170), degreesToRadians(-170));

    expect(score.angular_error_signed_deg).toBeCloseTo(20, precision);
  });

  it("keeps exact opposite-direction errors at +180", () => {
    const score = scoreJrd(degreesToRadians(0), degreesToRadians(180));

    expect(score.angular_error_signed_deg).toBeCloseTo(180, precision);
    expect(score.angular_error_signed).toBeCloseTo(Math.PI, precision);
  });
});
