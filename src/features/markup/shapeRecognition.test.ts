import { describe, expect, test } from "vitest";
import type { Point } from "../drawings/viewer/viewTransform";
import { recogniseShape } from "./shapeRecognition";

/** A steady hand's wobble: deterministic, a few page units. */
function wobble(points: Point[], amount = 2): Point[] {
  return points.map((p, i) => ({
    x: p.x + Math.sin(i * 1.7) * amount,
    y: p.y + Math.cos(i * 2.3) * amount,
  }));
}

/** A stroke round the corners, `steps` points per side, ending near the start. */
function polygon(corners: Point[], steps = 20, shake = 2): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    for (let s = 0; s < steps; s++)
      out.push({
        x: a.x + ((b.x - a.x) * s) / steps,
        y: a.y + ((b.y - a.y) * s) / steps,
      });
  }
  out.push({ x: corners[0].x + 3, y: corners[0].y + 2 });
  return wobble(out, shake);
}

function ellipse(
  c: Point,
  rx: number,
  ry: number,
  tilt = 0,
  n = 80,
  shake = 2,
) {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    out.push({
      x: c.x + x * Math.cos(tilt) - y * Math.sin(tilt),
      y: c.y + x * Math.sin(tilt) + y * Math.cos(tilt),
    });
  }
  return wobble(out, shake);
}

function rotate(points: Point[], c: Point, angle: number): Point[] {
  return points.map((p) => ({
    x: c.x + (p.x - c.x) * Math.cos(angle) - (p.y - c.y) * Math.sin(angle),
    y: c.y + (p.x - c.x) * Math.sin(angle) + (p.y - c.y) * Math.cos(angle),
  }));
}

const RECT = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 260 },
  { x: 100, y: 260 },
];

describe("draw and hold: shapes", () => {
  test("a near circle is a circle", () => {
    const r = recogniseShape(ellipse({ x: 300, y: 300 }, 100, 95))!;
    expect(r.tool).toBe("ellipse");
    const [a, b] = r.points;
    expect(b.x - a.x).toBeCloseTo(b.y - a.y, 5);
    expect((a.x + b.x) / 2).toBeCloseTo(300, -1);
  });

  test("a level ellipse stays level; a tilted one keeps its angle", () => {
    expect(recogniseShape(ellipse({ x: 300, y: 300 }, 160, 80))!.tool).toBe(
      "ellipse",
    );
    const tilted = recogniseShape(
      ellipse({ x: 300, y: 300 }, 160, 80, Math.PI / 6),
    )!;
    expect(tilted.tool).toBe("oval");
    const [c, major] = tilted.points;
    expect(Math.atan2(major.y - c.y, major.x - c.x)).toBeCloseTo(
      Math.PI / 6,
      1,
    );
  });

  test("a level rectangle is the Rectangle shape; a square is square", () => {
    const r = recogniseShape(polygon(RECT))!;
    expect(r.tool).toBe("rect");
    expect(r.points[0].x).toBeCloseTo(100, -1);
    expect(r.points[1].y).toBeCloseTo(260, -1);
    const sq = recogniseShape(
      polygon([
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 290 },
        { x: 100, y: 290 },
      ]),
    )!;
    expect(sq.tool).toBe("rect");
    const [a, b] = sq.points;
    expect(b.x - a.x).toBeCloseTo(b.y - a.y, 5);
  });

  test("a tilted rectangle keeps its angle, with right-angled corners", () => {
    const r = recogniseShape(
      polygon(rotate(RECT, { x: 250, y: 180 }, Math.PI / 8)),
    )!;
    expect(r.tool).toBe("polygon");
    expect(r.points).toHaveLength(4);
    const [a, b, c] = r.points;
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
    expect(Math.abs(dot)).toBeLessThan(1e-6);
  });

  test("triangles and pentagons go through their corners", () => {
    const tri = recogniseShape(
      polygon([
        { x: 100, y: 400 },
        { x: 250, y: 120 },
        { x: 400, y: 400 },
      ]),
    )!;
    expect(tri.tool).toBe("polygon");
    expect(tri.points).toHaveLength(3);
    const pent = Array.from({ length: 5 }, (_, i) => ({
      x: 300 + 150 * Math.cos((2 * Math.PI * i) / 5 - Math.PI / 2),
      y: 300 + 150 * Math.sin((2 * Math.PI * i) / 5 - Math.PI / 2),
    }));
    const p = recogniseShape(polygon(pent))!;
    expect(p.tool).toBe("polygon");
    expect(p.points).toHaveLength(5);
  });

  test("open strokes and scribbles aren't shapes", () => {
    const open = Array.from({ length: 40 }, (_, i) => ({
      x: 100 + i * 8,
      y: 100 + Math.sin(i / 4) * 30,
    }));
    expect(recogniseShape(open)).toBeNull();
    const scribble = Array.from({ length: 120 }, (_, i) => ({
      x: 300 + Math.sin(i * 0.9) * (40 + (i % 7) * 15),
      y: 300 + Math.cos(i * 1.3) * (30 + (i % 5) * 20),
    }));
    scribble.push({ ...scribble[0] });
    expect(recogniseShape(scribble)).toBeNull();
  });

  test("a shaky hand still gets its shape", () => {
    expect(
      recogniseShape(ellipse({ x: 300, y: 300 }, 120, 110, 0, 80, 7))!.tool,
    ).toBe("ellipse");
    expect(recogniseShape(polygon(RECT, 20, 7))!.tool).toBe("rect");
    expect(
      recogniseShape(
        polygon(
          [
            { x: 100, y: 400 },
            { x: 250, y: 120 },
            { x: 400, y: 400 },
          ],
          20,
          7,
        ),
      )!.points,
    ).toHaveLength(3);
  });
});
