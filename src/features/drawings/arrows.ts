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
  /**
   * From the pin to the base of the head, through the dog leg's elbow when
   * it has one.
   */
  line: Point[];
  /** The head: tip, then the two back corners. */
  head: [Point, Point, Point];
}

/**
 * A dog leg's elbow, in fractions of the sheet's short side from the pin's
 * centre: the PDF pin's radius (0.8%) plus two pin widths (engineer,
 * 2026-10-06), so about two pin widths of shoulder show beside the pin.
 */
const ELBOW = 0.008 + 2 * 0.016;

/**
 * The line and head for an arrow from `from` (the pin) to `to` (the tip),
 * both in page units: a dog leg, drafting style (engineer, 2026-10-06), a
 * horizontal shoulder out of the pin's side facing the tip, then straight
 * to it. A tip above or below the pin (within the shoulder) gets a straight
 * line. Null when the points are too close to draw a head.
 */
export function arrowShape(
  from: Point,
  to: Point,
  page: Size,
): ArrowShape | null {
  const m = arrowMetrics(page);
  const elbow = Math.min(page.width, page.height) * ELBOW;
  const dx = to.x - from.x;
  const line =
    Math.abs(dx) > elbow
      ? [from, { x: from.x + Math.sign(dx) * elbow, y: from.y }]
      : [from];
  // The last leg carries the head; too short for one, the arrow is straight.
  let start = line[line.length - 1];
  if (Math.hypot(to.x - start.x, to.y - start.y) <= m.headLength) {
    line.length = 1;
    start = from;
  }
  const lx = to.x - start.x;
  const ly = to.y - start.y;
  const length = Math.hypot(lx, ly);
  if (length < m.headLength) return null;
  const ux = lx / length;
  const uy = ly / length;
  const base = { x: to.x - ux * m.headLength, y: to.y - uy * m.headLength };
  const half = m.headWidth / 2;
  return {
    line: [...line, base],
    head: [
      to,
      { x: base.x - uy * half, y: base.y + ux * half },
      { x: base.x + uy * half, y: base.y - ux * half },
    ],
  };
}
