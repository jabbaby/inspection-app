/**
 * Arrows from a pin to the spots it refers to (SPEC section 5). Pure
 * geometry in page units (PDF points), shared by the viewer and, in build
 * step 8, the PDF export, so both draw them the same. Sizes scale with the
 * sheet, like the notes box.
 */
import type { Point, Size } from "./viewer/viewTransform";

export interface ArrowMetrics {
  strokeWidth: number;
  headLength: number;
  headWidth: number;
}

/** About 4 pt line and a 30 pt head on A1; 1.5 pt and 11 pt on A4. */
export function arrowMetrics(page: Size): ArrowMetrics {
  const short = Math.min(page.width, page.height);
  const headLength = short * 0.018;
  return {
    strokeWidth: short * 0.0025,
    headLength,
    headWidth: headLength * 0.8,
  };
}

export interface ArrowShape {
  /** From the pin to the base of the head. */
  line: [Point, Point];
  /** The head: tip, then the two back corners. */
  head: [Point, Point, Point];
}

/**
 * The line and head for an arrow from `from` (the pin) to `to` (the tip),
 * both in page units. Null when the points are too close to draw a head.
 */
export function arrowShape(
  from: Point,
  to: Point,
  page: Size,
): ArrowShape | null {
  const m = arrowMetrics(page);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < m.headLength) return null;
  const ux = dx / length;
  const uy = dy / length;
  const base = { x: to.x - ux * m.headLength, y: to.y - uy * m.headLength };
  const half = m.headWidth / 2;
  return {
    line: [from, base],
    head: [
      to,
      { x: base.x - uy * half, y: base.y + ux * half },
      { x: base.x + uy * half, y: base.y - ux * half },
    ],
  };
}
