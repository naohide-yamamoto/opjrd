import { describe, expect, it } from "vitest";
import {
  clampCoordinateToCanvasShape,
  clampCoordinateToCircle,
} from "../src/trials/trial-rendering";
import { createCanvasMapping } from "../src/trials/canvas-geometry";

describe("trial rendering helpers", () => {
  it("leaves coordinates inside the circular canvas unchanged", () => {
    expect(clampCoordinateToCircle({ x: 3, y: 4 }, 5)).toEqual({ x: 3, y: 4 });
    expect(clampCoordinateToCircle({ x: 0, y: 0 }, 5)).toEqual({ x: 0, y: 0 });
  });

  it("projects coordinates outside the circular canvas to the circle edge", () => {
    const clamped = clampCoordinateToCircle({ x: 6, y: 8 }, 5);

    expect(clamped.x).toBeCloseTo(3);
    expect(clamped.y).toBeCloseTo(4);
  });

  it("uses square bounds when the canvas shape is square", () => {
    const mapping = createCanvasMapping(100, 100, 5);
    const clamped = clampCoordinateToCanvasShape(
      { x: 6, y: 8 },
      mapping,
      {
        shape: "square",
        sizePx: 760,
        widthPx: 760,
        heightPx: 760,
        visible: true,
      }
    );

    expect(clamped.x).toBeCloseTo(5);
    expect(clamped.y).toBeCloseTo(5);
  });

  it("uses rectangular bounds when the canvas shape is rectangle", () => {
    const mapping = createCanvasMapping(200, 100, 5);
    const clamped = clampCoordinateToCanvasShape(
      { x: 12, y: 8 },
      mapping,
      {
        shape: "rectangle",
        sizePx: 760,
        widthPx: 200,
        heightPx: 100,
        visible: true,
      }
    );

    expect(clamped.x).toBeCloseTo(10);
    expect(clamped.y).toBeCloseTo(5);
  });
});
