/**
 * Markup geometry (SPEC section 5a), shared by the viewer, the pinch
 * snapshot and the PDF export so all three draw a mark the same way. Pure:
 * page units (PDF points, y down) in, numbers and SVG path data out.
 */
import {
  SHAPES,
  type Markup,
  type MarkupShape,
  type MarkupTool,
} from "../../db/types";
import type { Point, Size } from "../drawings/viewer/viewTransform";
import { TEXT_SIZES, calloutOutline } from "./calloutGeometry";

/** Weight presets as a fraction of the sheet's short side (medium = a pin arrow). */
export const WEIGHT_PRESETS: Record<MarkupTool, [number, number, number]> = {
  pen: [0.0012, 0.0025, 0.005],
  highlighter: [0.006, 0.012, 0.02],
  shapes: [0.0012, 0.0025, 0.005],
  // Text: S, M, L (the size of its letters).
  text: TEXT_SIZES,
};

/** The weight slider's range per tool. */
export const WEIGHT_RANGE: Record<MarkupTool, [number, number]> = {
  pen: [0.0006, 0.01],
  highlighter: [0.003, 0.03],
  shapes: [0.0006, 0.01],
  text: [0.006, 0.03],
};

/** How see-through the highlighter is (drawn with multiply in the PDF). */
export const HIGHLIGHTER_OPACITY = 0.4;

/** Line width in page units. */
export function markWidth(weight: number, page: Size): number {
  return weight * Math.min(page.width, page.height);
}

/** Flat normalised points to page-unit points. */
export function toPagePoints(points: number[], page: Size): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 1 < points.length; i += 2)
    out.push({ x: points[i] * page.width, y: points[i + 1] * page.height });
  return out;
}

/** Page-unit points to flat normalised points, rounded (keeps files small). */
export function toStoredPoints(points: Point[], page: Size): number[] {
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  return points.flatMap((p) => [
    round(p.x / page.width),
    round(p.y / page.height),
  ]);
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t =
    length2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2),
        );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Drops points that stay within `tolerance` of the line through their
 * neighbours (Ramer-Douglas-Peucker), so a long stroke stores a few dozen
 * points instead of hundreds.
 */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let worst = -1;
    let worstDistance = tolerance;
    for (let i = first + 1; i < last; i++) {
      const d = distanceToSegment(points[i], points[first], points[last]);
      if (d > worstDistance) {
        worst = i;
        worstDistance = d;
      }
    }
    if (worst >= 0) {
      keep[worst] = true;
      stack.push([first, worst], [worst, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/**
 * SVG path data for a stroke: straight segments through its points, exactly
 * where the Pencil went (at 240 points a second they read as a smooth
 * line). A single point becomes a dot (a zero-length line with round caps).
 */
export function strokePath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const to = rest.length ? rest : [first];
  return (
    `M ${fmt(first.x)} ${fmt(first.y)}` +
    to.map((p) => ` L ${fmt(p.x)} ${fmt(p.y)}`).join("")
  );
}

/**
 * Drops points that sit almost on top of the last one kept (closer than a
 * third of the line's width); the ends always stay. Every point left is a
 * real Pencil position, so the line isn't reshaped: this only removes the
 * sub-pixel back-and-forth wobble that made thick lines double back on
 * themselves, which Apple's renderer (Safari, PDF viewers) drew with white
 * crescents. Page units in and out.
 */
export function thinStroke(points: Point[], width: number): Point[] {
  if (points.length <= 2) return points;
  const gap = width / 3;
  const kept: Point[] = [points[0]];
  for (const p of points.slice(1, -1)) {
    const last = kept[kept.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= gap) kept.push(p);
  }
  const end = points[points.length - 1];
  const last = kept[kept.length - 1];
  // The end always stays: it replaces a kept point too close to it.
  if (kept.length > 1 && Math.hypot(end.x - last.x, end.y - last.y) < gap)
    kept[kept.length - 1] = end;
  else kept.push(end);
  return kept;
}

/**
 * A light evening-out once the Pencil has lifted: each point is averaged
 * with its neighbours (twice), the ends stay put. The stroke being drawn
 * isn't smoothed, so the line still follows the tip exactly.
 */
export function smoothLifted(points: Point[]): Point[] {
  let out = points;
  for (let pass = 0; pass < 2 && out.length > 2; pass++) {
    const prev = out;
    out = prev.map((p, i) =>
      i === 0 || i === prev.length - 1
        ? p
        : {
            x: (prev[i - 1].x + 2 * p.x + prev[i + 1].x) / 4,
            y: (prev[i - 1].y + 2 * p.y + prev[i + 1].y) / 4,
          },
    );
  }
  return out;
}

/** A saved mark's path data in page units: thinned, then evened out. */
export function markPath(
  mark: Pick<Markup, "points" | "weight">,
  page: Size,
): string {
  return strokePath(
    smoothLifted(
      thinStroke(toPagePoints(mark.points, page), markWidth(mark.weight, page)),
    ),
  );
}

/** How a mark is stroked, in page units. */
export function markStyle(
  mark: Pick<Markup, "tool" | "colour" | "weight">,
  page: Size,
): { width: number; colour: string; opacity: number } {
  return {
    width: markWidth(mark.weight, page),
    colour: mark.colour,
    opacity: mark.tool === "highlighter" ? HIGHLIGHTER_OPACITY : 1,
  };
}

/** Whether `p` (page units) is within `reach` of the mark's line. */
export function touchesMark(
  mark: Pick<Markup, "tool" | "points" | "weight">,
  page: Size,
  p: Point,
  reach: number,
): boolean {
  const points = drawMark(mark, page).outline;
  const limit = reach + markWidth(mark.weight, page) / 2;
  if (points.length === 1)
    return Math.hypot(p.x - points[0].x, p.y - points[0].y) <= limit;
  for (let i = 1; i < points.length; i++)
    if (distanceToSegment(p, points[i - 1], points[i]) <= limit) return true;
  return false;
}

// --- shapes (slice 2b) ------------------------------------------------------

/** How much of a closed shape's colour fills it (engineer decision). */
export const SHAPE_FILL_OPACITY = 0.1;
/** Arrowheads keep a pin arrow's proportions, scaled by the line weight. */
const HEAD_LENGTH = 7;
const HEAD_WIDTH = 0.8;
/** A cloud's bumps, as a multiple of the line weight (they grow with it). */
const BUMP = 10;
/** Bezier handle length for a quarter ellipse. */
const KAPPA = 0.5522847498;

export function isShape(kind: Markup["tool"]): kind is MarkupShape {
  return (SHAPES as readonly string[]).includes(kind);
}

/** Everything needed to draw a mark, in page units. */
export interface MarkDrawing {
  /** Path data to stroke (and, when `closed`, to fill lightly). */
  d: string;
  closed: boolean;
  /** An arrowhead, filled solid. */
  head: string | null;
  /** Points along the line, for the eraser. */
  outline: Point[];
}

const pathOf = (points: Point[], close = false) =>
  `M ${points.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(" L ")}${close ? " Z" : ""}`;

/** A quadratic curve (from, control, to) as path data for the exact cubic. */
function quadAsCubic(from: Point, c: Point, to: Point) {
  const c1 = {
    x: from.x + (2 / 3) * (c.x - from.x),
    y: from.y + (2 / 3) * (c.y - from.y),
  };
  const c2 = {
    x: to.x + (2 / 3) * (c.x - to.x),
    y: to.y + (2 / 3) * (c.y - to.y),
  };
  return ` C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(to.x)} ${fmt(to.y)}`;
}

function quadPoint(from: Point, c: Point, to: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * c.y + t * t * to.y,
  };
}

/** A shape from its two corners (where the drag started and ended). */
export function shapeDrawing(
  shape: MarkupShape,
  a: Point,
  b: Point,
  width: number,
): MarkDrawing {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  if (shape === "line")
    return { d: pathOf([a, b]), closed: false, head: null, outline: [a, b] };
  if (shape === "arrow") {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const headLength = Math.min(width * HEAD_LENGTH, length);
    const half = (headLength * HEAD_WIDTH) / 2;
    const ux = length ? (b.x - a.x) / length : 1;
    const uy = length ? (b.y - a.y) / length : 0;
    const base = { x: b.x - ux * headLength, y: b.y - uy * headLength };
    return {
      d: pathOf([a, base]),
      closed: false,
      head: pathOf(
        [
          b,
          { x: base.x - uy * half, y: base.y + ux * half },
          { x: base.x + uy * half, y: base.y - ux * half },
        ],
        true,
      ),
      outline: [a, b],
    };
  }
  const corners = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  if (shape === "rect")
    return {
      d: pathOf(corners, true),
      closed: true,
      head: null,
      outline: [...corners, corners[0]],
    };
  if (shape === "ellipse") {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = (x1 - x0) / 2;
    const ry = (y1 - y0) / 2;
    const kx = rx * KAPPA;
    const ky = ry * KAPPA;
    const p = (x: number, y: number) => `${fmt(x)} ${fmt(y)}`;
    const d =
      `M ${p(cx + rx, cy)}` +
      ` C ${p(cx + rx, cy + ky)} ${p(cx + kx, cy + ry)} ${p(cx, cy + ry)}` +
      ` C ${p(cx - kx, cy + ry)} ${p(cx - rx, cy + ky)} ${p(cx - rx, cy)}` +
      ` C ${p(cx - rx, cy - ky)} ${p(cx - kx, cy - ry)} ${p(cx, cy - ry)}` +
      ` C ${p(cx + kx, cy - ry)} ${p(cx + rx, cy - ky)} ${p(cx + rx, cy)} Z`;
    const outline = Array.from({ length: 49 }, (_, i) => {
      const t = (i / 48) * Math.PI * 2;
      return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
    });
    return { d, closed: true, head: null, outline };
  }
  // Revision cloud: bumps round the box, bulging outwards, sized by the
  // line weight.
  const chord = Math.max(width * BUMP, 1);
  let d = `M ${fmt(x0)} ${fmt(y0)}`;
  const outline: Point[] = [corners[0]];
  corners.forEach((from, i) => {
    const to = corners[(i + 1) % 4];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const n = Math.max(1, Math.round(length / chord));
    const ux = (to.x - from.x) / n;
    const uy = (to.y - from.y) / n;
    const unit = Math.hypot(ux, uy) || 1;
    // Clockwise in y-down coordinates, so (uy, -ux) points out of the box.
    const nx = uy / unit;
    const ny = -ux / unit;
    const bulge = unit * 0.55;
    for (let k = 0; k < n; k++) {
      const s = { x: from.x + ux * k, y: from.y + uy * k };
      const e = { x: s.x + ux, y: s.y + uy };
      const c = {
        x: (s.x + e.x) / 2 + nx * bulge,
        y: (s.y + e.y) / 2 + ny * bulge,
      };
      d += quadAsCubic(s, c, e);
      for (let j = 1; j <= 6; j++) outline.push(quadPoint(s, c, e, j / 6));
    }
  });
  return { d: `${d} Z`, closed: true, head: null, outline };
}

/** Whether a mark is drawn with its light fill (closed shapes, unless taken off). */
export function isFilled(
  mark: Pick<Markup, "tool" | "fill">,
  drawing: MarkDrawing,
): boolean {
  return drawing.closed && mark.fill !== false;
}

/** Whether `p` (page units) is inside a filled shape (its outline, closed). */
export function insideMark(
  mark: Pick<Markup, "tool" | "points" | "weight" | "fill">,
  page: Size,
  p: Point,
): boolean {
  const drawing = drawMark(mark, page);
  if (!isFilled(mark, drawing)) return false;
  const poly = drawing.outline;
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

/** How to draw any mark: a stroke (thinned, evened out) or a shape. */
export function drawMark(
  mark: Pick<Markup, "tool" | "points" | "weight">,
  page: Size,
): MarkDrawing {
  // A callout is drawn with its text (calloutGeometry.ts); this is its
  // outline, for the eraser.
  if (mark.tool === "text")
    return {
      d: "",
      closed: false,
      head: null,
      outline: calloutOutline(mark, page),
    };
  const points = toPagePoints(mark.points, page);
  const width = markWidth(mark.weight, page);
  if (isShape(mark.tool) && points.length >= 2)
    return shapeDrawing(mark.tool, points[0], points[points.length - 1], width);
  const line = smoothLifted(thinStroke(points, width));
  return { d: strokePath(line), closed: false, head: null, outline: line };
}
