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
 * SVG path data for a stroke through `points`: smoothed with curves through
 * the midpoints, so a simplified stroke still looks drawn. A single point
 * becomes a dot (a zero-length line with round caps).
 *
 * Each piece is the quadratic curve from one midpoint to the next (bent by
 * the point between), written as the exact cubic equivalent: pdf-lib turns
 * an SVG "Q" into a PDF "v" curve, which isn't the same shape and has no
 * direction at its start, and Apple's PDF renderer then leaves white nicks
 * where the pieces join.
 */
export function strokePath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first] = points;
  if (points.length === 1)
    return `M ${fmt(first.x)} ${fmt(first.y)} L ${fmt(first.x)} ${fmt(first.y)}`;
  if (points.length === 2)
    return `M ${fmt(first.x)} ${fmt(first.y)} L ${fmt(points[1].x)} ${fmt(points[1].y)}`;
  let d = `M ${fmt(first.x)} ${fmt(first.y)}`;
  let from = first;
  for (let i = 1; i < points.length - 1; i++) {
    const q = points[i];
    const next = points[i + 1];
    const to = { x: (q.x + next.x) / 2, y: (q.y + next.y) / 2 };
    // Quadratic (from, q, to) as a cubic: control points 2/3 of the way to q.
    const c1 = {
      x: from.x + (2 / 3) * (q.x - from.x),
      y: from.y + (2 / 3) * (q.y - from.y),
    };
    const c2 = {
      x: to.x + (2 / 3) * (q.x - to.x),
      y: to.y + (2 / 3) * (q.y - to.y),
    };
    d += ` C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(to.x)} ${fmt(to.y)}`;
    from = to;
  }
  const last = points[points.length - 1];
  return `${d} L ${fmt(last.x)} ${fmt(last.y)}`;
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
