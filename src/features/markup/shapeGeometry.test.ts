import { describe, expect, test } from "vitest";
import type { Markup } from "../../db/types";
import {
  drawMark,
  insideMark,
  isFilled,
  markWidth,
  shapeDrawing,
  touchesMark,
} from "./markGeometry";

const A3 = { width: 1191, height: 842 };

const shape = (
  tool: Markup["tool"],
  fill?: boolean,
): Pick<Markup, "tool" | "points" | "weight" | "fill"> => ({
  tool,
  points: [0.2, 0.2, 0.6, 0.5],
  weight: 0.0025,
  fill,
});

describe("shapes", () => {
  test("lines and arrows go any direction; only closed shapes fill", () => {
    const line = drawMark(shape("line"), A3);
    expect(line.d).toBe("M 238.2 168.4 L 714.6 421");
    expect(line.closed).toBe(false);
    for (const tool of ["rect", "ellipse", "cloud"] as const) {
      const drawing = drawMark(shape(tool), A3);
      expect(drawing.closed).toBe(true);
      expect(isFilled(shape(tool), drawing)).toBe(true);
      expect(isFilled(shape(tool, false), drawing)).toBe(false);
    }
  });

  test("an arrowhead scales with the line weight and ends on the point", () => {
    const thin = shapeDrawing("arrow", { x: 0, y: 0 }, { x: 100, y: 0 }, 1);
    const thick = shapeDrawing("arrow", { x: 0, y: 0 }, { x: 100, y: 0 }, 3);
    expect(thin.head).toBe("M 100 0 L 93 2.8 L 93 -2.8 Z");
    expect(thick.head).toBe("M 100 0 L 79 8.4 L 79 -8.4 Z");
    // The line stops at the head's base.
    expect(thick.d).toBe("M 0 0 L 79 0");
  });

  test("a cloud's bumps grow with the weight and bulge outwards", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 120, y: 60 };
    const bumps = (w: number) =>
      (shapeDrawing("cloud", a, b, w).d.match(/ C /g) ?? []).length;
    expect(bumps(2)).toBe(6 + 3 + 6 + 3); // 20-unit bumps
    expect(bumps(4)).toBeLessThan(bumps(2));
    const top = shapeDrawing("cloud", a, b, 2).outline.filter(
      (p) => p.x > 1 && p.x < 119 && p.y < 0,
    );
    expect(top.length).toBeGreaterThan(0); // above the box: outwards
  });

  test("inside a filled shape; not once its fill is off", () => {
    const size = A3;
    const centre = { x: 0.4 * size.width, y: 0.35 * size.height };
    const outside = { x: 0.1 * size.width, y: 0.1 * size.height };
    for (const tool of ["rect", "ellipse", "cloud"] as const) {
      expect(insideMark(shape(tool), size, centre)).toBe(true);
      expect(insideMark(shape(tool), size, outside)).toBe(false);
      expect(insideMark(shape(tool, false), size, centre)).toBe(false);
    }
    expect(insideMark(shape("line"), size, centre)).toBe(false);
  });

  test("the eraser touches a shape's outline, not its middle", () => {
    const reach = 4;
    const edge = { x: 0.2 * A3.width, y: 0.35 * A3.height };
    const centre = { x: 0.4 * A3.width, y: 0.35 * A3.height };
    expect(touchesMark(shape("rect"), A3, edge, reach)).toBe(true);
    expect(touchesMark(shape("rect"), A3, centre, reach)).toBe(false);
    expect(markWidth(0.0025, A3)).toBeCloseTo(2.1, 1);
  });
});
