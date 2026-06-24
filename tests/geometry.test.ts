import { describe, expect, it } from "vitest";
import { angleFromUpAnticlockwise, radiansToDegrees } from "../src/core/angles";
import {
  buildTrialGeometry,
  calculateCanonicalTransform,
  headingRelativeToZero,
} from "../src/core/geometry";
import type { LocationIndex } from "../src/core/types";

const precision = 8;

describe("response-relative angle convention", () => {
  it("labels cardinal directions with down at +180 degrees", () => {
    expect(radiansToDegrees(angleFromUpAnticlockwise({ x: 0, y: 1 }))).toBeCloseTo(
      0,
      precision
    );
    expect(radiansToDegrees(angleFromUpAnticlockwise({ x: -1, y: 0 }))).toBeCloseTo(
      90,
      precision
    );
    expect(radiansToDegrees(angleFromUpAnticlockwise({ x: 1, y: 0 }))).toBeCloseTo(
      -90,
      precision
    );
    expect(radiansToDegrees(angleFromUpAnticlockwise({ x: 0, y: -1 }))).toBeCloseTo(
      180,
      precision
    );
  });
});

describe("imagined heading", () => {
  it("uses the experimenter-defined zero direction and anticlockwise-positive convention", () => {
    const zeroDirection = { x: 0, y: 1 };
    const a = { x: 1, y: 0 };
    const b = { x: 0, y: 1 };
    const c = { x: 1, y: 1 };

    expect(radiansToDegrees(headingRelativeToZero(a, b, zeroDirection))).toBeCloseTo(
      45,
      precision
    );
    expect(radiansToDegrees(headingRelativeToZero(a, c, zeroDirection))).toBeCloseTo(
      0,
      precision
    );
    expect(radiansToDegrees(headingRelativeToZero(b, a, zeroDirection))).toBeCloseTo(
      225,
      precision
    );
  });

  it("rejects zero-length zero-direction vectors", () => {
    expect(() =>
      headingRelativeToZero(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 0 }
      )
    ).toThrow(/zeroDirection/u);
  });

  it("supports non-default zero directions", () => {
    expect(
      radiansToDegrees(
        headingRelativeToZero(
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 0 }
        )
      )
    ).toBeCloseTo(90, precision);
  });
});

describe("canonical transform", () => {
  it("keeps a default north-facing A-to-B vector aligned with the response up direction", () => {
    const transform = calculateCanonicalTransform(
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      4
    );

    expect(transform.truePosition.x).toBeCloseTo(-4, precision);
    expect(transform.truePosition.y).toBeCloseTo(4, precision);
    expect(radiansToDegrees(transform.trueAngle)).toBeCloseTo(45, precision);
  });

  it("rotates an east-facing A-to-B vector so left of facing is positive angular direction", () => {
    const transform = calculateCanonicalTransform(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      4
    );

    expect(transform.truePosition.x).toBeCloseTo(-4, precision);
    expect(transform.truePosition.y).toBeCloseTo(0, precision);
    expect(radiansToDegrees(transform.trueAngle)).toBeCloseTo(90, precision);
  });

  it("builds trial geometry with imagined heading and transformed target position", () => {
    const locations: LocationIndex = {
      A: { x: 1, y: 0 },
      B: { x: 0, y: 1 },
      C: { x: 1, y: 1 },
    };

    const trial = buildTrialGeometry(
      {
        trialId: "1",
        location: "A",
        direction: "B",
        target: "C",
      },
      locations,
      { x: 0, y: 1 },
      4
    );

    expect(trial.imaginedHeadingDeg).toBeCloseTo(45, precision);
    expect(trial.truePosition.x).toBeCloseTo(2, precision);
    expect(trial.truePosition.y).toBeCloseTo(2, precision);
    expect(trial.trueAngleDeg).toBeCloseTo(-45, precision);
  });
});
