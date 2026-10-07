import { describe, expect, test } from "vitest";
import type { Markup } from "../../db/types";
import { WEIGHT_PRESETS, drawMark, rotatePoint } from "./markGeometry";
import {
  clampMove,
  markBounds,
  marksInLoop,
  movedPoints,
  pickMark,
  resizedPoints,
  rotatedMark,
  rotationBy,
  rotationCentre,
  selectionBounds,
  shapeHandles,
  weightIndex,
} from "./selectGeometry";

const PAGE = { width: 1000, height: 1000 };

function mark(
  id: string,
  tool: Markup["tool"],
  points: number[],
  extra: Partial<Markup> = {},
) {
  return { id, tool, points, weight: 0.0025, ...extra };
}

const line = mark("line", "line", [0.1, 0.1, 0.3, 0.1]);
const rect = mark("rect", "rect", [0.5, 0.5, 0.7, 0.6]);
const callout = mark("text", "text", [0.2, 0.7, 0.1, 0.05, 0.1, 0.9], {
  weight: 0.012,
});

describe("select", () => {
  test("a tap picks the mark under it, or inside a filled shape", () => {
    const marks = [line, rect, callout];
    expect(pickMark(marks, PAGE, { x: 200, y: 102 }, 5)?.id).toBe("line");
    expect(pickMark(marks, PAGE, { x: 600, y: 550 }, 5)?.id).toBe("rect");
    expect(pickMark(marks, PAGE, { x: 250, y: 720 }, 5)?.id).toBe("text");
    expect(pickMark(marks, PAGE, { x: 900, y: 900 }, 5)).toBeNull();
  });

  test("a loop takes in any mark with a part inside it", () => {
    // Round the line's right end only, and across the rectangle's corner.
    const loop = [
      { x: 250, y: 50 },
      { x: 550, y: 50 },
      { x: 550, y: 520 },
      { x: 250, y: 520 },
    ];
    const picked = marksInLoop([line, rect, callout], PAGE, loop);
    expect(picked.map((m) => m.id).sort()).toEqual(["line", "rect"]);
  });

  test("moving shifts every point; a callout's size stays", () => {
    expect(movedPoints(line, 0.1, 0.2)).toEqual([0.2, 0.3, 0.4, 0.3]);
    expect(movedPoints(callout, 0.1, -0.1)).toEqual([
      0.3, 0.6, 0.1, 0.05, 0.2, 0.8,
    ]);
  });

  test("a move is cut back at the page's edges", () => {
    const bounds = selectionBounds([rect], PAGE);
    const { dx, dy } = clampMove(bounds, PAGE, 1, -1);
    expect((bounds.x + bounds.width) / 1000 + dx).toBeCloseTo(1, 5);
    expect(bounds.y / 1000 + dy).toBeCloseTo(0, 5);
  });

  test("bounds include the line's width", () => {
    const b = markBounds(line, PAGE);
    expect(b.x).toBeLessThan(100);
    expect(b.width).toBeGreaterThan(200);
  });

  test("a box resizes from its handles; a line from its ends", () => {
    expect(shapeHandles(rect, PAGE)).toHaveLength(8);
    expect(shapeHandles(line, PAGE).map((h) => h.id)).toEqual(["start", "end"]);
    expect(shapeHandles(mark("pen", "pen", [0, 0, 1, 1]), PAGE)).toEqual([]);
    expect(resizedPoints(rect, "se", { x: 0.9, y: 0.8 })).toEqual([
      0.5, 0.5, 0.9, 0.8,
    ]);
    // Dragged past the other side, the box stays the right way round.
    expect(resizedPoints(rect, "w", { x: 0.8, y: 0 })).toEqual([
      0.7, 0.5, 0.8, 0.6,
    ]);
    expect(resizedPoints(line, "end", { x: 0.4, y: 0.4 })).toEqual([
      0.1, 0.1, 0.4, 0.4,
    ]);
  });

  test("weights are matched to their tool's presets", () => {
    expect(weightIndex(line)).toBe(1);
    expect(
      weightIndex({
        tool: "highlighter",
        weight: WEIGHT_PRESETS.highlighter[2],
      }),
    ).toBe(2);
    expect(weightIndex({ tool: "pen", weight: 0.004 })).toBe(-1);
  });

  test("a turned rectangle is drawn turned about its middle", () => {
    const turned = { ...rect, rotation: Math.PI / 2 };
    const outline = drawMark(turned, PAGE).outline;
    // 200 x 100 at (600, 550) turned a quarter: 100 wide, 200 tall.
    const xs = outline.map((p) => p.x);
    const ys = outline.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 5);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(200, 5);
  });

  test("turning: box shapes keep their box and gain a rotation; strokes turn point by point", () => {
    const c = rotationCentre([rect], PAGE);
    expect(c).toEqual({ x: 600, y: 550 });
    const r = rotatedMark(rect, PAGE, c, Math.PI / 4);
    expect(r.points).toEqual(rect.points);
    expect(r.rotation).toBeCloseTo(Math.PI / 4, 9);
    const l = rotatedMark(line, PAGE, { x: 100, y: 100 }, Math.PI / 2);
    expect(l.points[2]).toBeCloseTo(0.1, 5);
    expect(l.points[3]).toBeCloseTo(0.3, 5);
    expect(l.rotation).toBeUndefined();
    // A callout's text stays level: only its box and tip move.
    const t = rotatedMark(callout, PAGE, { x: 250, y: 725 }, Math.PI);
    expect(t.points[2]).toBe(0.1);
    expect(t.rotation).toBeUndefined();
  });

  test("turns snap to level and 45 degrees", () => {
    const c = { x: 600, y: 550 };
    const from = { x: 600, y: 450 };
    const nearly = rotatePoint(from, c, Math.PI / 4 + 0.03);
    expect(rotationBy([rect], c, from, nearly)).toBeCloseTo(Math.PI / 4, 9);
    const free = rotatePoint(from, c, 0.3);
    expect(rotationBy([rect], c, from, free)).toBeCloseTo(0.3, 9);
  });

  test("a turned box resizes along its own sides; its far corner stays put", () => {
    const turned = { ...rect, rotation: Math.PI / 2 };
    const before = drawMark(turned, PAGE).outline;
    // The level box's nw corner, turned: where it sits on the page.
    const nw = rotatePoint({ x: 500, y: 500 }, { x: 600, y: 550 }, Math.PI / 2);
    // Drag the se handle a bit further out along the turned sides.
    const seNow = rotatePoint(
      { x: 700, y: 600 },
      { x: 600, y: 550 },
      Math.PI / 2,
    );
    const to = { x: (seNow.x - 20) / 1000, y: (seNow.y + 40) / 1000 };
    const points = resizedPoints(turned, "se", to, PAGE);
    const after = drawMark({ ...turned, points }, PAGE).outline;
    const near = (p: { x: number; y: number }) =>
      after.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.5);
    expect(near(nw)).toBe(true);
    expect(after).not.toEqual(before);
  });
});
