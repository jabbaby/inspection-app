/**
 * Draw and hold (SPEC section 5a, engineer 2026-10-07): a pen or
 * highlighter stroke held still at its end becomes the shape it looks like.
 * An open stroke is a straight line (as before). A closed one is a circle
 * or ellipse, a rectangle or square, a triangle, or a polygon through its
 * corners, keeping its angle; anything unclear stays as drawn. Pure: page
 * units (PDF points, y down) in and out.
 */
import type { Point } from "../drawings/viewer/viewTransform";
import { simplify } from "./markGeometry";

/** What a held stroke became; points in page units. */
export interface Recognised {
  /**
   * "rect" and "ellipse" are level boxes (two corners, like the shape
   * tools); "polygon" is its corners; "oval" a tilted ellipse: its centre
   * and the ends of its two axes.
   */
  tool: "rect" | "ellipse" | "polygon" | "oval";
  points: Point[];
}

/** Samples along the stroke for fitting. */
const SAMPLES = 96;
/** Ends this close (a fraction of the stroke's size) make it closed. */
const CLOSED = 0.25;
/** Corners turn at least this much (degrees). */
const CORNER_TURN = 28;
/** Within this many degrees of level, a shape is made level. */
const LEVEL = 4;
/** Sides within this fraction of each other make a square; axes, a circle. */
const SQUARE = 0.12;
const ROUND = 0.88;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** The stroke as `n` points evenly spaced along it. */
function resample(points: Point[], n: number): Point[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(lengths[i - 1] + dist(points[i - 1], points[i]));
  const total = lengths[lengths.length - 1];
  const out: Point[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / n;
    while (j < points.length - 1 && lengths[j] < target) j++;
    const span = lengths[j] - lengths[j - 1] || 1;
    const t = Math.min(1, Math.max(0, (target - lengths[j - 1]) / span));
    out.push({
      x: points[j - 1].x + (points[j].x - points[j - 1].x) * t,
      y: points[j - 1].y + (points[j].y - points[j - 1].y) * t,
    });
  }
  return out;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
    : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The best ellipse by moments, and how far the samples stray from it. */
function fitEllipse(samples: Point[], size: number) {
  const n = samples.length;
  const c = {
    x: samples.reduce((s, p) => s + p.x, 0) / n,
    y: samples.reduce((s, p) => s + p.y, 0) / n,
  };
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of samples) {
    sxx += (p.x - c.x) ** 2;
    syy += (p.y - c.y) ** 2;
    sxy += (p.x - c.x) * (p.y - c.y);
  }
  sxx /= n;
  syy /= n;
  sxy /= n;
  // Eigen of [[sxx, sxy], [sxy, syy]]: points evenly round an ellipse have
  // a variance of r² / 2 along each axis.
  const mean = (sxx + syy) / 2;
  const diff = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy);
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const r1 = Math.sqrt(2 * (mean + diff));
  const r2 = Math.sqrt(2 * Math.max(0, mean - diff));
  const e1 = { x: Math.cos(angle), y: Math.sin(angle) };
  const e2 = { x: -e1.y, y: e1.x };
  let error = 0;
  for (const p of samples) {
    const d = { x: p.x - c.x, y: p.y - c.y };
    const u = (d.x * e1.x + d.y * e1.y) / (r1 || 1);
    const v = (d.x * e2.x + d.y * e2.y) / (r2 || 1);
    // Radial miss, in page units, as a fraction of the stroke's size.
    const r = Math.hypot(u, v);
    error += (Math.abs(r - 1) * Math.hypot(u * r1, v * r2)) / (r || 1);
  }
  return { c, r1, r2, angle, e1, e2, error: error / n / size };
}

/** The corners of a closed stroke: simplified, then nearly straight ones dropped. */
function corners(samples: Point[], size: number): Point[] {
  const loop = [...samples, samples[0]];
  let poly = simplify(loop, size * 0.04).slice(0, -1);
  for (let changed = true; changed && poly.length > 2;) {
    changed = false;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[(i - 1 + poly.length) % poly.length];
      const b = poly[i];
      const c = poly[(i + 1) % poly.length];
      const turn = Math.abs(
        ((((Math.atan2(c.y - b.y, c.x - b.x) -
          Math.atan2(b.y - a.y, b.x - a.x)) *
          180) /
          Math.PI +
          540) %
          360) -
          180,
      );
      if (turn < CORNER_TURN || dist(a, b) < size * 0.08) {
        poly = poly.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return poly;
}

function polygonError(samples: Point[], poly: Point[], size: number) {
  let error = 0;
  for (const p of samples) {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++)
      best = Math.min(
        best,
        distanceToSegment(p, poly[i], poly[(i + 1) % poly.length]),
      );
    error += best;
  }
  return error / samples.length / size;
}

/** Degrees off the nearest level (horizontal or vertical) direction. */
function offLevel(angle: number): number {
  const deg = ((((angle * 180) / Math.PI) % 90) + 90) % 90;
  return Math.min(deg, 90 - deg);
}

/** Four corners near right angles as a true rectangle (a square if nearly one). */
function rectangle(poly: Point[]): Recognised | null {
  for (let i = 0; i < 4; i++) {
    const a = poly[(i + 3) % 4];
    const b = poly[i];
    const c = poly[(i + 1) % 4];
    const cos =
      ((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)) /
      (dist(a, b) * dist(c, b) || 1);
    if (Math.abs(cos) > Math.sin((20 * Math.PI) / 180)) return null;
  }
  // The angle of the longest side, made level when it nearly is.
  let longest = 0;
  for (let i = 1; i < 4; i++)
    if (
      dist(poly[i], poly[(i + 1) % 4]) > dist(poly[longest], poly[longest + 1])
    )
      longest = i;
  const p = poly[longest];
  const q = poly[(longest + 1) % 4];
  let angle = Math.atan2(q.y - p.y, q.x - p.x);
  if (offLevel(angle) < LEVEL)
    angle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  const ux = { x: Math.cos(angle), y: Math.sin(angle) };
  const uy = { x: -ux.y, y: ux.x };
  const cx = poly.reduce((s, v) => s + v.x, 0) / 4;
  const cy = poly.reduce((s, v) => s + v.y, 0) / 4;
  const us = poly.map((v) => (v.x - cx) * ux.x + (v.y - cy) * ux.y);
  const vs = poly.map((v) => (v.x - cx) * uy.x + (v.y - cy) * uy.y);
  let [u0, u1] = [Math.min(...us), Math.max(...us)];
  let [v0, v1] = [Math.min(...vs), Math.max(...vs)];
  const w = u1 - u0;
  const h = v1 - v0;
  if (Math.abs(w - h) < SQUARE * Math.max(w, h)) {
    const s = (w + h) / 2;
    const um = (u0 + u1) / 2;
    const vm = (v0 + v1) / 2;
    [u0, u1, v0, v1] = [um - s / 2, um + s / 2, vm - s / 2, vm + s / 2];
  }
  const at = (u: number, v: number) => ({
    x: cx + u * ux.x + v * uy.x,
    y: cy + u * ux.y + v * uy.y,
  });
  if (offLevel(angle) < 1e-6) {
    const a = at(u0, v0);
    const b = at(u1, v1);
    return {
      tool: "rect",
      points: [
        { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
        { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
      ],
    };
  }
  return {
    tool: "polygon",
    points: [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)],
  };
}

/** A clean ellipse: a circle if nearly round, level if nearly level. */
function ellipse(fit: ReturnType<typeof fitEllipse>): Recognised {
  const { c, e1, e2 } = fit;
  let { r1, r2 } = fit;
  if (r2 / r1 > ROUND) r1 = r2 = (r1 + r2) / 2;
  if (r1 === r2 || offLevel(fit.angle) < LEVEL) {
    // Level: a box like the Ellipse tool's (its axes along x and y).
    const horizontal = Math.abs(e1.x) >= Math.abs(e1.y);
    const rx = horizontal ? r1 : r2;
    const ry = horizontal ? r2 : r1;
    return {
      tool: "ellipse",
      points: [
        { x: c.x - rx, y: c.y - ry },
        { x: c.x + rx, y: c.y + ry },
      ],
    };
  }
  return {
    tool: "oval",
    points: [
      c,
      { x: c.x + e1.x * r1, y: c.y + e1.y * r1 },
      { x: c.x + e2.x * r2, y: c.y + e2.y * r2 },
    ],
  };
}

/**
 * The shape a closed stroke looks like, or null (keep it as drawn, or for
 * an open stroke, the caller's straight line).
 */
export function recogniseShape(stroke: Point[]): Recognised | null {
  if (stroke.length < 8) return null;
  const xs = stroke.map((p) => p.x);
  const ys = stroke.map((p) => p.y);
  const size = Math.hypot(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  if (!size || dist(stroke[0], stroke[stroke.length - 1]) > CLOSED * size)
    return null;
  const samples = resample(stroke, SAMPLES);
  const oval = fitEllipse(samples, size);
  const poly = corners(samples, size);
  const polyError = poly.length >= 3 ? polygonError(samples, poly, size) : 1;
  const k = poly.length;
  // Few clear corners, and an ellipse fits clearly worse: a polygon.
  if (
    k >= 3 &&
    k <= 8 &&
    polyError < 0.025 &&
    (k <= 4 || polyError < oval.error * 0.6)
  ) {
    if (k === 4) return rectangle(poly) ?? { tool: "polygon", points: poly };
    return { tool: "polygon", points: poly };
  }
  if (oval.error < 0.06) return ellipse(oval);
  if (k >= 3 && k <= 10 && polyError < 0.04)
    return { tool: "polygon", points: poly };
  return null;
}
