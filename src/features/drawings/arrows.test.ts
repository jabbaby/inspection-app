import { describe, expect, test } from "vitest";
import { arrowMetrics, arrowShape } from "./arrows";

const A1 = { width: 2383.94, height: 1683.78 };
const A4 = { width: 595.28, height: 841.89 };

describe("arrows", () => {
  test("scale with the sheet", () => {
    expect(arrowMetrics(A1).strokeWidth).toBeCloseTo(4.21, 1);
    expect(arrowMetrics(A4).headLength).toBeCloseTo(10.72, 1);
  });

  test("point from the pin to the tip, head on the tip", () => {
    const shape = arrowShape({ x: 100, y: 100 }, { x: 400, y: 100 }, A1)!;
    const m = arrowMetrics(A1);
    expect(shape.head[0]).toEqual({ x: 400, y: 100 });
    expect(shape.line[0]).toEqual({ x: 100, y: 100 });
    // The line stops at the head's base.
    expect(shape.line[1].x).toBeCloseTo(400 - m.headLength);
    expect(shape.line[1].y).toBeCloseTo(100);
    // The back corners sit either side of the line.
    expect(shape.head[1].x).toBeCloseTo(400 - m.headLength);
    expect(Math.abs(shape.head[1].y - shape.head[2].y)).toBeCloseTo(
      m.headWidth,
    );
  });

  test("work in any direction", () => {
    const shape = arrowShape({ x: 300, y: 300 }, { x: 100, y: 500 }, A1)!;
    const [tip, a, b] = shape.head;
    const m = arrowMetrics(A1);
    // Both back corners are one head-length-ish behind the tip.
    for (const corner of [a, b])
      expect(Math.hypot(corner.x - tip.x, corner.y - tip.y)).toBeGreaterThan(
        m.headLength,
      );
  });

  test("are left out when the tip is on top of the pin", () => {
    expect(arrowShape({ x: 100, y: 100 }, { x: 105, y: 100 }, A1)).toBeNull();
  });
});
