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
  boxCentre,
  drawMark,
  insideMark,
  isBoxShape,
  isShape,
  markWidth,
  rotatePoint,
  toPagePoints,
  touchesMark,
} from "./markGeometry";

type SelectMark = Pick<
  Markup,
  "id" | "tool" | "points" | "weight" | "fill" | "highlight" | "rotation"
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
  | "width"
  // Turns the selection about its middle (engineer, 2026-10-07).
  | "rotate";

/**
 * A single selected shape's resize handles, in page units: a callout's
 * arrow tip and width; none for strokes or tilted shapes.
 */
export function shapeHandles(
  mark: Pick<Markup, "tool" | "points" | "rotation">,
  page: Size,
): { id: HandleId; at: Point }[] {
  const level = levelHandles(mark, page);
  if (!mark.rotation || !isBoxShape(mark.tool)) return level;
  // A turned box: its handles turn with it, about its middle.
  const c = boxCentre(toPagePoints(mark.points, page));
  return level.map((h) => ({
    id: h.id,
    at: rotatePoint(h.at, c, mark.rotation!),
  }));
}

function levelHandles(
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
  mark: Pick<Markup, "tool" | "points" | "rotation">,
  id: HandleId,
  to: Point,
  page: Size = { width: 1, height: 1 },
): number[] {
  if (mark.rotation && isBoxShape(mark.tool)) {
    // A turned box: the drag is measured along its own sides (the handle
    // brought back level about the middle), then the resized box is put
    // back so its far side stays where it was on the page.
    const angle = mark.rotation;
    const c0 = boxCentre(toPagePoints(mark.points, page));
    const local = rotatePoint(
      { x: to.x * page.width, y: to.y * page.height },
      c0,
      -angle,
    );
    const level = resizedLevel(mark.points, id, {
      x: local.x / page.width,
      y: local.y / page.height,
    });
    const c1 = boxCentre(toPagePoints(level, page));
    const moved = rotatePoint(c1, c0, angle);
    return level.map((v, i) =>
      round(
        i % 2
          ? v + (moved.y - c1.y) / page.height
          : v + (moved.x - c1.x) / page.width,
      ),
    );
  }
  return resizedLevel(mark.points, id, to);
}

function resizedLevel(points: number[], id: HandleId, to: Point): number[] {
  const [ax, ay, bx, by] = points;
  const x = round(to.x);
  const y = round(to.y);
  // A callout's tip moves; its width is sized by the caller (it measures
  // the text); turning is rotatedMark's.
  if (id === "tip") return [...points.slice(0, 4), x, y];
  if (id === "width" || id === "rotate") return points;
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

/** Screen px from the top of the selection to its rotate handle. */
export const ROTATE_OFFSET_PX = 30;

/** Where a selection turns about: a single box shape's middle, else the selection's. */
export function rotationCentre(marks: SelectMark[], page: Size): Point {
  if (marks.length === 1 && isBoxShape(marks[0].tool))
    return boxCentre(toPagePoints(marks[0].points, page));
  const b = selectionBounds(marks, page);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * The rotate handle (page units), `offset` above the selection: above a
 * single turned box's top edge, turning with it; else above the middle of
 * the selection's box. None for a lone callout (its text stays level).
 */
export function rotateHandle(
  marks: SelectMark[],
  page: Size,
  offset: number,
): Point | null {
  if (marks.length === 0 || marks.every((m) => m.tool === "text")) return null;
  if (marks.length === 1 && isBoxShape(marks[0].tool)) {
    const [a, b] = toPagePoints(marks[0].points, page);
    const c = boxCentre([a, b]);
    const top = { x: c.x, y: Math.min(a.y, b.y) - offset };
    return rotatePoint(top, c, marks[0].rotation ?? 0);
  }
  const b = selectionBounds(marks, page);
  return { x: b.x + b.width / 2, y: b.y - offset };
}

/** Angles within this of a multiple of 45° snap to it (radians). */
const SNAP = (4 * Math.PI) / 180;

function snapAngle(angle: number): number {
  const step = Math.PI / 4;
  const nearest = Math.round(angle / step) * step;
  return Math.abs(angle - nearest) < SNAP ? nearest : angle;
}

/**
 * How far the rotate handle, grabbed at `from` and now at `to` (page
 * units), turns the selection about `c`. A single box's resulting angle
 * snaps to level and 45° steps; a group's turn snaps the same way.
 */
export function rotationBy(
  marks: SelectMark[],
  c: Point,
  from: Point,
  to: Point,
): number {
  const turn =
    Math.atan2(to.y - c.y, to.x - c.x) - Math.atan2(from.y - c.y, from.x - c.x);
  if (marks.length === 1 && isBoxShape(marks[0].tool)) {
    const start = marks[0].rotation ?? 0;
    return snapAngle(start + turn) - start;
  }
  return snapAngle(turn);
}

/**
 * A mark turned by `angle` about `c` (page units): a box shape's middle
 * moves and its rotation grows; a callout's box moves (its text stays
 * level) with its tip; anything else turns point by point.
 */
export function rotatedMark(
  mark: Pick<Markup, "tool" | "points" | "rotation">,
  page: Size,
  c: Point,
  angle: number,
): { points: number[]; rotation?: number } {
  const units = (x: number, y: number) => ({
    x: x * page.width,
    y: y * page.height,
  });
  const turned = (x: number, y: number) => {
    const p = rotatePoint(units(x, y), c, angle);
    return [round(p.x / page.width), round(p.y / page.height)];
  };
  if (isBoxShape(mark.tool)) {
    const pts = toPagePoints(mark.points, page);
    const m = boxCentre(pts);
    const moved = rotatePoint(m, c, angle);
    const dx = (moved.x - m.x) / page.width;
    const dy = (moved.y - m.y) / page.height;
    return {
      points: mark.points.map((v, i) => round(v + (i % 2 ? dy : dx))),
      rotation: normaliseAngle((mark.rotation ?? 0) + angle),
    };
  }
  if (mark.tool === "text") {
    const [x, y, w, h, tx, ty] = mark.points;
    const mid = units(x + w / 2, y + h / 2);
    const moved = rotatePoint(mid, c, angle);
    const nx = moved.x / page.width - w / 2;
    const ny = moved.y / page.height - h / 2;
    return {
      points: [
        round(nx),
        round(ny),
        w,
        h,
        ...(tx === undefined || ty === undefined ? [] : turned(tx, ty)),
      ],
    };
  }
  const out: number[] = [];
  for (let i = 0; i + 1 < mark.points.length; i += 2)
    out.push(...turned(mark.points[i], mark.points[i + 1]));
  return { points: out };
}

/** An angle in (-π, π], near-level values made exactly level. */
function normaliseAngle(a: number): number {
  let r = Math.atan2(Math.sin(a), Math.cos(a));
  if (Math.abs(r) < 1e-6) r = 0;
  return r;
}
