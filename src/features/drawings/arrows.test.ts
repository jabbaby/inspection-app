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
    const end = shape.line[shape.line.length - 1];
    expect(end.x).toBeCloseTo(400 - m.headLength);
    expect(end.y).toBeCloseTo(100);
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

  test("to the side: a dog leg out of the pin's side facing the tip", () => {
    const elbow = 1683.78 * 0.04;
    const left = arrowShape({ x: 1000, y: 800 }, { x: 600, y: 400 }, A1)!;
    expect(left.line).toHaveLength(3);
    expect(left.line[1]).toEqual({ x: 1000 - elbow, y: 800 });
    expect(left.head[0]).toEqual({ x: 600, y: 400 });
    const right = arrowShape({ x: 1000, y: 800 }, { x: 1400, y: 1200 }, A1)!;
    expect(right.line[1]).toEqual({ x: 1000 + elbow, y: 800 });
  });

  test("above or below the pin: straight", () => {
    const shape = arrowShape({ x: 1000, y: 800 }, { x: 1030, y: 400 }, A1)!;
    expect(shape.line).toHaveLength(2);
    expect(shape.line[0]).toEqual({ x: 1000, y: 800 });
  });

  test("are left out when the tip is on top of the pin", () => {
    expect(arrowShape({ x: 100, y: 100 }, { x: 105, y: 100 }, A1)).toBeNull();
  });
});
