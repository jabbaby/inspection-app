/**
 * Markup geometry (SPEC section 5a), shared by the viewer, the pinch
 * snapshot and the PDF export so all three draw a mark the same way. Pure:
 * page units (PDF points, y down) in, numbers and SVG path data out.
 */
import type { Markup, MarkupTool } from "../../db/types";
import type { Point, Size } from "../drawings/viewer/viewTransform";

/** Weight presets as a fraction of the sheet's short side (medium = a pin arrow). */
export const WEIGHT_PRESETS: Record<MarkupTool, [number, number, number]> = {
  pen: [0.0012, 0.0025, 0.005],
  highlighter: [0.006, 0.012, 0.02],
};

/** The weight slider's range per tool. */
export const WEIGHT_RANGE: Record<MarkupTool, [number, number]> = {
  pen: [0.0006, 0.01],
  highlighter: [0.003, 0.03],
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

/** A saved mark's path data in page units (see thinStroke). */
export function markPath(
  mark: Pick<Markup, "points" | "weight">,
  page: Size,
): string {
  return strokePath(
    thinStroke(toPagePoints(mark.points, page), markWidth(mark.weight, page)),
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
  mark: Pick<Markup, "points" | "weight">,
  page: Size,
  p: Point,
  reach: number,
): boolean {
  const points = toPagePoints(mark.points, page);
  const limit = reach + markWidth(mark.weight, page) / 2;
  if (points.length === 1)
    return Math.hypot(p.x - points[0].x, p.y - points[0].y) <= limit;
  for (let i = 1; i < points.length; i++)
    if (distanceToSegment(p, points[i - 1], points[i]) <= limit) return true;
  return false;
}
