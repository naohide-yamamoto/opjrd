import { describe, expect, it } from "vitest";
import { calculateWorldExtent } from "../src/trials/canvas-geometry";
import type { ResponseInterfaceConfig, TrialGeometry } from "../src/core/types";

function makeTrial(truePosition: { x: number; y: number }): TrialGeometry {
  return {
    trialId: "1",
    location: "A",
    direction: "B",
    target: "C",
    truePosition,
    trueAngle: 0,
    trueAngleDeg: 0,
    trueDistance: Math.hypot(truePosition.x, truePosition.y),
    imaginedHeading: 0,
    imaginedHeadingDeg: 0,
  };
}

function makeResponse(
  cInitialPosition: { x: number; y: number }
): ResponseInterfaceConfig {
  return {
    abDistance: 4,
    layoutRadius: 6,
    canvas: {
      objectPlacement: {
        shape: "circle",
        sizePx: 760,
        widthPx: 760,
        heightPx: 760,
        visible: true,
      },
      jrd: {
        shape: "square",
        sizePx: 760,
        widthPx: 760,
        heightPx: 760,
        visible: true,
      },
    },
    trialStartGate: {
      enabled: true,
      label: "Start",
      position: { x: 0, y: 0 },
      widthPx: null,
      heightPx: null,
      warningEnabled: true,
      warningDelayMsec: 5000,
      warningMessage:
        "Please click the {label} button to begin a trial.",
    },
    feedback: {
      colour: "#0b5fff",
      durationMsec: 1000,
    },
    text: {
      objectLabels: {
        colour: "#101828",
        sizePx: 48,
        fontFamily: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      },
      supportLabels: {
        colour: "#475467",
        sizePx: 28,
        fontFamily: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      },
      supportLabelOffsets: {
        at: { x: 0, y: 1 },
        facing: { x: 0, y: 1 },
        place: { x: 0, y: 0.85 },
        pointTo: { x: 0, y: 1 },
      },
    },
    stimuli: {
      mode: "text",
      imageSizePx: 72,
      images: {},
    },
    objectPlacement: {
      finalisationKey: " ",
      requireMoveBeforeFinalise: true,
      moveRequiredWarningMessage:
        "Move the target object before pressing the {finalisationKey}.",
      cInitialPosition,
    },
  };
}

describe("canvas geometry", () => {
  it("sizes the object-placement canvas by radial extent", () => {
    expect(
      calculateWorldExtent(makeTrial({ x: 3, y: 4 }), makeResponse({ x: 0, y: 0 }))
    ).toBe(7);
    const diagonalExtent = calculateWorldExtent(
      makeTrial({ x: 10, y: 10 }),
      makeResponse({ x: 0, y: 0 })
    );

    expect(diagonalExtent).toBeCloseTo(Math.hypot(10, 10) + 1);
  });
});
