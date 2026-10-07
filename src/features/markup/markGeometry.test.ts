import { describe, expect, test } from "vitest";
import {
  drawMark,
  isFilled,
  markPath,
  markWidth,
  smoothLifted,
  thinStroke,
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

  test("stroke path: straight segments exactly through the points", () => {
    expect(strokePath([{ x: 1, y: 2 }])).toBe("M 1 2 L 1 2");
    expect(
      strokePath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toBe("M 0 0 L 10 0 L 10 10");
  });

  test("thinning drops only points almost on top of the last one", () => {
    // 240 Hz samples wobbling by up to 0.6 pt along a gentle curve.
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const raw = Array.from({ length: 400 }, (_, i) => ({
      x: 100 + i * 0.5 + (random() - 0.5) * 1.2,
      y: 200 + Math.sin(i / 60) * 30 + (random() - 0.5) * 1.2,
    }));
    const width = 4;
    const thin = thinStroke(raw, width);
    expect(thin[0]).toEqual(raw[0]);
    expect(thin.at(-1)).toEqual(raw.at(-1));
    // Every point left is one the Pencil reported: nothing is reshaped.
    for (const p of thin) expect(raw).toContainEqual(p);
    for (let i = 1; i < thin.length - 1; i++)
      expect(
        Math.hypot(thin[i].x - thin[i - 1].x, thin[i].y - thin[i - 1].y),
      ).toBeGreaterThanOrEqual(width / 3);
  });

  test("after lifting, a stroke is evened out a little; the ends stay", () => {
    const zigzag = Array.from({ length: 9 }, (_, i) => ({
      x: i * 10,
      y: i % 2 ? 6 : 0,
    }));
    const even = smoothLifted(zigzag);
    expect(even[0]).toEqual(zigzag[0]);
    expect(even.at(-1)).toEqual(zigzag.at(-1));
    const wobble = (pts: { y: number }[]) =>
      Math.max(...pts.slice(1, -1).map((p) => p.y)) -
      Math.min(...pts.slice(1, -1).map((p) => p.y));
    expect(wobble(even)).toBeLessThan(wobble(zigzag) / 2);
  });

  test("a mark's path goes through its own points", () => {
    const d = markPath(
      { points: [0.1, 0.1, 0.1001, 0.1, 0.2, 0.2], weight: 0.0025 },
      A3,
    );
    expect(d).toBe("M 119.1 84.2 L 238.2 168.4");
  });

  test("the eraser touches a mark within reach of its line", () => {
    const mark = {
      tool: "pen" as const,
      points: [0.1, 0.5, 0.9, 0.5],
      weight: 0.0025,
    };
    const y = 0.5 * A3.height;
    expect(touchesMark(mark, A3, { x: 500, y: y + 5 }, 4)).toBe(true);
    expect(touchesMark(mark, A3, { x: 500, y: y + 20 }, 4)).toBe(false);
    expect(touchesMark(mark, A3, { x: 50, y }, 4)).toBe(false);
  });

  test("held shapes: a polygon through its corners, a tilted ellipse as cubics", () => {
    const page = { width: 1000, height: 1000 };
    const tri = drawMark(
      {
        tool: "polygon",
        points: [0.1, 0.1, 0.3, 0.1, 0.2, 0.3],
        weight: 0.0025,
      },
      page,
    );
    expect(tri.closed).toBe(true);
    expect(tri.outline).toHaveLength(4);
    const oval = drawMark(
      {
        tool: "oval",
        points: [0.5, 0.5, 0.6, 0.55, 0.48, 0.54],
        weight: 0.0025,
      },
      page,
    );
    expect(oval.d).toMatch(/C/);
    expect(oval.d).not.toMatch(/Q/);
    // The outline passes through the major axis's end.
    expect(
      Math.min(...oval.outline.map((p) => Math.hypot(p.x - 600, p.y - 550))),
    ).toBeLessThan(0.01);
    // Held with the highlighter: never filled.
    expect(isFilled({ tool: "polygon", highlight: true }, tri)).toBe(false);
    expect(isFilled({ tool: "polygon" }, tri)).toBe(true);
  });
});
