import { describe, expect, test } from "vitest";
import {
  markPath,
  markWidth,
  smoothStroke,
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

  test("Pencil jitter is evened out: the line never doubles back", () => {
    // 240 Hz samples along a gentle curve, wobbling by up to 0.6 pt.
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const raw = Array.from({ length: 400 }, (_, i) => ({
      x: 100 + i * 0.5 + (random() - 0.5) * 1.2,
      y: 200 + Math.sin(i / 60) * 30 + (random() - 0.5) * 1.2,
    }));
    const width = 4;
    const even = smoothStroke(raw, width);
    expect(even[0]).toEqual(raw[0]);
    expect(even.at(-1)).toEqual(raw.at(-1));
    expect(even.length).toBeLessThan(raw.length / 3);
    for (let i = 2; i < even.length; i++) {
      const a = {
        x: even[i - 1].x - even[i - 2].x,
        y: even[i - 1].y - even[i - 2].y,
      };
      const b = { x: even[i].x - even[i - 1].x, y: even[i].y - even[i - 1].y };
      const cos =
        (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
      // Turns of more than 60 degrees would be a wobble, not the curve.
      expect(cos).toBeGreaterThan(0.5);
    }
  });

  test("while drawing, the newest points aren't evened out", () => {
    const zigzag = Array.from({ length: 12 }, (_, i) => ({
      x: i * 10,
      y: i % 2 ? 6 : 0,
    }));
    const even = smoothStroke(zigzag, 4, 3);
    expect(even.slice(-4)).toEqual(zigzag.slice(-4));
    expect(even[5]).not.toEqual(zigzag[5]);
  });

  test("a mark's path is drawn from its evened-out points", () => {
    const d = markPath(
      { points: [0.1, 0.1, 0.1001, 0.1, 0.2, 0.2], weight: 0.0025 },
      A3,
    );
    expect(d.startsWith("M 119.1 84.2")).toBe(true);
    expect(d).not.toMatch(/[QqTtVv]/);
  });

  test("the eraser touches a mark within reach of its line", () => {
    const mark = { points: [0.1, 0.5, 0.9, 0.5], weight: 0.0025 };
    const y = 0.5 * A3.height;
    expect(touchesMark(mark, A3, { x: 500, y: y + 5 }, 4)).toBe(true);
    expect(touchesMark(mark, A3, { x: 500, y: y + 20 }, 4)).toBe(false);
    expect(touchesMark(mark, A3, { x: 50, y }, 4)).toBe(false);
  });
});
