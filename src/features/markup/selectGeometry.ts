/**
 * The Select tool (SPEC section 5a, slice 2d): picking marks with a tap or
 * a loop, their bounds, moving them, and resizing one shape. Pure: page
 * units (PDF points, y down) and normalised stored points in, numbers out.
 */
import type { Markup, MarkupTool } from "../../db/types";
import type { Point, Rect, Size } from "../drawings/viewer/viewTransform";
import { calloutPlace, insideCallout } from "./calloutGeometry";
import {
  WEIGHT_PRESETS,
  drawMark,
  insideMark,
  isShape,
  markWidth,
  touchesMark,
} from "./markGeometry";

type SelectMark = Pick<
  Markup,
  "id" | "tool" | "points" | "weight" | "fill" | "highlight"
>;

/** The toolbar tool whose weights a mark uses. */
export function weightToolOf(
  mark: Pick<Markup, "tool" | "highlight">,
): MarkupTool {
  if (mark.highlight) return "highlighter";
  if (
    mark.tool === "pen" ||
    mark.tool === "highlighter" ||
    mark.tool === "text"
  )
    return mark.tool;
  return "shapes";
}

/** Which of its tool's three presets a mark's weight is (-1: none). */
export function weightIndex(
  mark: Pick<Markup, "tool" | "weight" | "highlight">,
): number {
  return WEIGHT_PRESETS[weightToolOf(mark)].findIndex(
    (w) => Math.abs(w - mark.weight) < 1e-9,
  );
}

/** A mark's bounding box in page units, including its line's width. */
export function markBounds(mark: SelectMark, page: Size): Rect {
  let points: Point[];
  let pad = 0;
  if (mark.tool === "text") {
    const { box, tip } = calloutPlace(mark, page);
    points = [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y + box.height },
      ...(tip ? [tip] : []),
    ];
  } else {
    points = drawMark(mark, page).outline;
    const width = markWidth(mark.weight, page);
    // An arrowhead is wider than its line.
    pad = mark.tool === "arrow" ? width * 3 : width / 2;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return {
    x,
    y,
    width: Math.max(...xs) + pad - x,
    height: Math.max(...ys) + pad - y,
  };
}

/** The box round several marks (page units). */
export function selectionBounds(marks: SelectMark[], page: Size): Rect {
  const boxes = marks.map((m) => markBounds(m, page));
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

/**
 * The mark a tap at `p` (page units) picks: the top one whose line is
 * within `reach`, or that it lands inside (a filled shape or a callout's
 * box). Callouts sit over other marks, so they're tried first.
 */
export function pickMark<M extends SelectMark>(
  marks: M[],
  page: Size,
  p: Point,
  reach: number,
): M | null {
  const order = [
    ...marks.filter((m) => m.tool === "text"),
    ...marks.filter((m) => m.tool !== "text"),
  ];
  for (let i = order.length - 1; i >= 0; i--) {
    const mark = order[i];
    if (mark.tool === "text") {
      const grown = calloutPlace(mark, page).box;
      const inBox =
        p.x >= grown.x - reach &&
        p.x <= grown.x + grown.width + reach &&
        p.y >= grown.y - reach &&
        p.y <= grown.y + grown.height + reach;
      if (inBox || insideCallout(mark, page, p)) return mark;
    }
    if (touchesMark(mark, page, p, reach) || insideMark(mark, page, p))
      return mark;
  }
  return null;
}

function insidePolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = side(c, d, a);
  const d2 = side(c, d, b);
  const d3 = side(a, b, c);
  const d4 = side(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * The marks a loop (page units, closed back to its start) takes in: any
 * part inside counts (engineer, 2026-10-07), so a mark with a point inside
 * or a line crossing the loop is picked.
 */
export function marksInLoop<M extends SelectMark>(
  marks: M[],
  page: Size,
  loop: Point[],
): M[] {
  if (loop.length < 3) return [];
  const edges = loop.map((p, i) => [p, loop[(i + 1) % loop.length]] as const);
  return marks.filter((mark) => {
    const outline = drawMark(mark, page).outline;
    if (outline.some((p) => insidePolygon(p, loop))) return true;
    for (let i = 1; i < outline.length; i++)
      for (const [c, d] of edges)
        if (crosses(outline[i - 1], outline[i], c, d)) return true;
    return false;
  });
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/** A mark's stored points moved by (dx, dy), normalised on its page. */
export function movedPoints(
  mark: Pick<Markup, "tool" | "points">,
  dx: number,
  dy: number,
): number[] {
  if (mark.tool === "text") {
    // Box x, y, width, height, then the tip: the size doesn't move.
    const [x, y, w, h, ...tip] = mark.points;
    return [
      round(x + dx),
      round(y + dy),
      w,
      h,
      ...tip.map((v, i) => round(v + (i % 2 ? dy : dx))),
    ];
  }
  return mark.points.map((v, i) => round(v + (i % 2 ? dy : dx)));
}

/** A move (normalised) cut back so `bounds` (page units) stays on the page. */
export function clampMove(
  bounds: Rect,
  page: Size,
  dx: number,
  dy: number,
): { dx: number; dy: number } {
  const clamp = (d: number, lo: number, size: number, extent: number) =>
    Math.min(Math.max(d, -lo / size), (size - lo - extent) / size);
  return {
    dx: clamp(dx, bounds.x, page.width, bounds.width),
    dy: clamp(dy, bounds.y, page.height, bounds.height),
  };
}

/** Handles on one selected shape: its box's corners and sides, or a line's ends. */
export type HandleId =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "start"
  | "end"
  // A callout's arrow tip and its box's width (as with the Text tool).
  | "tip"
  | "width";

/**
 * A single selected shape's resize handles, in page units: a callout's
 * arrow tip and width; none for strokes or tilted shapes.
 */
export function shapeHandles(
  mark: Pick<Markup, "tool" | "points">,
  page: Size,
): { id: HandleId; at: Point }[] {
  if (mark.tool === "text") {
    const { box, tip } = calloutPlace(mark, page);
    return [
      ...(tip ? [{ id: "tip" as const, at: tip }] : []),
      {
        id: "width",
        at: { x: box.x + box.width, y: box.y + box.height / 2 },
      },
    ];
  }
  if (!isShape(mark.tool) || mark.points.length < 4) return [];
  const [ax, ay, bx, by] = mark.points;
  const a = { x: ax * page.width, y: ay * page.height };
  const b = { x: bx * page.width, y: by * page.height };
  if (mark.tool === "line" || mark.tool === "arrow")
    return [
      { id: "start", at: a },
      { id: "end", at: b },
    ];
  const l = Math.min(a.x, b.x);
  const r = Math.max(a.x, b.x);
  const t = Math.min(a.y, b.y);
  const bt = Math.max(a.y, b.y);
  const mx = (l + r) / 2;
  const my = (t + bt) / 2;
  return [
    { id: "nw", at: { x: l, y: t } },
    { id: "n", at: { x: mx, y: t } },
    { id: "ne", at: { x: r, y: t } },
    { id: "e", at: { x: r, y: my } },
    { id: "se", at: { x: r, y: bt } },
    { id: "s", at: { x: mx, y: bt } },
    { id: "sw", at: { x: l, y: bt } },
    { id: "w", at: { x: l, y: my } },
  ];
}

/**
 * A shape's stored points with handle `id` dragged to `to` (normalised):
 * a line's end moves; a box's corner or side moves and the box is kept the
 * right way round.
 */
export function resizedPoints(
  mark: Pick<Markup, "tool" | "points">,
  id: HandleId,
  to: Point,
): number[] {
  const [ax, ay, bx, by] = mark.points;
  const x = round(to.x);
  const y = round(to.y);
  // A callout's tip moves; its width is sized by the caller (it measures
  // the text).
  if (id === "tip") return [...mark.points.slice(0, 4), x, y];
  if (id === "width") return mark.points;
  if (id === "start") return [x, y, bx, by];
  if (id === "end") return [ax, ay, x, y];
  let l = Math.min(ax, bx);
  let r = Math.max(ax, bx);
  let t = Math.min(ay, by);
  let b = Math.max(ay, by);
  if (id.includes("w")) l = x;
  if (id.includes("e")) r = x;
  if (id.includes("n")) t = y;
  if (id.includes("s")) b = y;
  return [Math.min(l, r), Math.min(t, b), Math.max(l, r), Math.max(t, b)];
}
