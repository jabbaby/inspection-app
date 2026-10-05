import { describe, expect, test } from "vitest";
import {
  markWidth,
  simplify,
  strokePath,
  toPagePoints,
  toStoredPoints,
  touchesMark,
  WEIGHT_PRESETS,
} from "./markGeometry";
import { arrowMetrics } from "../drawings/arrows";

const A1 = { width: 2384, height: 1684 };
const A3 = { width: 1191, height: 842 };

describe("mark geometry", () => {
  test("medium pen matches a pin arrow's line, on any sheet", () => {
    for (const page of [A1, A3])
      expect(markWidth(WEIGHT_PRESETS.pen[1], page)).toBeCloseTo(
        arrowMetrics(page).strokeWidth,
      );
  });

  test("points survive storing (to 5 decimals)", () => {
    const points = [
      { x: 100.123, y: 200.456 },
      { x: 300, y: 400 },
    ];
    const back = toPagePoints(toStoredPoints(points, A3), A3);
    back.forEach((p, i) => {
      expect(p.x).toBeCloseTo(points[i].x, 1);
      expect(p.y).toBeCloseTo(points[i].y, 1);
    });
  });

  test("simplify keeps corners and drops points along a straight run", () => {
    const line = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }));
    const corner = [...line, ...line.map((p) => ({ x: 49, y: p.x }))];
    const out = simplify(corner, 0.5);
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 49, y: 0 },
      { x: 49, y: 49 },
    ]);
  });

  test("stroke path: a dot, a line and a smoothed curve", () => {
    expect(strokePath([{ x: 1, y: 2 }])).toBe("M 1 2 L 1 2");
    expect(
      strokePath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe("M 0 0 L 10 0");
    expect(
      strokePath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toBe("M 0 0 C 6.67 0 10 1.67 10 5 L 10 10");
  });

  test("curves are plain cubics, which every PDF viewer strokes cleanly", () => {
    const d = strokePath(
      Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: (i % 3) * 7 })),
    );
    expect(d).not.toMatch(/[QqTtVv]/);
    expect(d.match(/C /g)).toHaveLength(18);
  });

  test("the eraser touches a mark within reach of its line", () => {
    const mark = { points: [0.1, 0.5, 0.9, 0.5], weight: 0.0025 };
    const y = 0.5 * A3.height;
    expect(touchesMark(mark, A3, { x: 500, y: y + 5 }, 4)).toBe(true);
    expect(touchesMark(mark, A3, { x: 500, y: y + 20 }, 4)).toBe(false);
    expect(touchesMark(mark, A3, { x: 50, y }, 4)).toBe(false);
  });
});
