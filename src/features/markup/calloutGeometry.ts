/**
 * Text callouts (SPEC section 5a, slice 2c): a white box of capitals with a
 * thin border in its colour, and an optional leader arrow to the point it
 * refers to. Pure geometry in page units (PDF points, y down), shared by
 * the viewer, the pinch snapshot and the PDF export, so all three lay the
 * text out the same way (Arial on screen, Helvetica in the PDF: the same
 * widths). Text is measured by the caller's font.
 */
import type { Markup } from "../../db/types";
import type { Point, Rect, Size } from "../drawings/viewer/viewTransform";

/** S, M, L as a fraction of the sheet's short side (M = the notes box text). */
export const TEXT_SIZES: [number, number, number] = [0.009, 0.012, 0.017];

/** Width of `text` at font size `size` (page units). */
export type MeasureText = (text: string, size: number) => number;

/** Arial's ascent and descent, as the notes box uses them. */
const ASCENT = 0.905;
const DESCENT = 0.212;
/** Leader arrowheads: as the arrow shape's, in border widths. */
const HEAD_LENGTH = 7;
const HEAD_WIDTH = 0.8;
/** The widest a box grows before its text wraps, in font sizes. */
const MAX_WIDTH_EM = 24;

export interface CalloutMetrics {
  fontSize: number;
  lineHeight: number;
  padding: number;
  border: number;
  /** Border plus padding: where the text starts in from the box's edge. */
  inset: number;
  maxWidth: number;
}

export function calloutMetrics(size: number, page: Size): CalloutMetrics {
  const fontSize = size * Math.min(page.width, page.height);
  const padding = fontSize * 0.45;
  const border = Math.max(0.5, fontSize * 0.08);
  return {
    fontSize,
    lineHeight: fontSize * 1.3,
    padding,
    border,
    inset: padding + border,
    maxWidth: fontSize * MAX_WIDTH_EM,
  };
}

/** Callout text is always capitals (like the notes box). */
export function calloutText(text: string): string {
  return text.toUpperCase();
}

/** Lines of `text` (capitals) wrapped to fit `inner` page units. */
export function wrapText(
  text: string,
  fontSize: number,
  inner: number,
  measure: MeasureText,
): string[] {
  const lines: string[] = [];
  for (const paragraph of calloutText(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, fontSize) > inner) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** The narrowest a box can be: its longest word fits. */
export function minCalloutWidth(
  text: string,
  m: CalloutMetrics,
  measure: MeasureText,
): number {
  const words = calloutText(text).split(/\s+/).filter(Boolean);
  return (
    Math.max(m.fontSize * 2, ...words.map((w) => measure(w, m.fontSize))) +
    2 * m.inset
  );
}

/**
 * The box a text needs: it grows to the widest line, up to the maximum.
 * With `width` (a box resized by hand) it keeps that width, never narrower
 * than its longest word, and only its height follows the text.
 */
export function calloutSize(
  text: string,
  m: CalloutMetrics,
  measure: MeasureText,
  width?: number,
): { width: number; height: number } {
  if (width !== undefined) {
    const w = Math.max(width, minCalloutWidth(text, m, measure));
    const lines = wrapText(text, m.fontSize, w - 2 * m.inset + 0.5, measure);
    return { width: w, height: lines.length * m.lineHeight + 2 * m.inset };
  }
  const lines = wrapText(text, m.fontSize, m.maxWidth - 2 * m.inset, measure);
  const widest = Math.max(
    m.fontSize * 2,
    ...lines.map((l) => measure(l, m.fontSize)),
  );
  return {
    width: widest + 2 * m.inset,
    height: lines.length * m.lineHeight + 2 * m.inset,
  };
}

/**
 * Which way a new box hangs from the point it was placed at: a callout
 * dragged out from its arrowhead keeps the corner nearest the tip there
 * (engineer, 2026-10-07), so it grows away from the arrow as it's typed.
 */
export interface CalloutHang {
  left: boolean;
  up: boolean;
}

/** The hang for a box placed at `at` with its leader to `tip`. */
export function calloutHang(at: Point, tip: Point): CalloutHang {
  return { left: tip.x > at.x, up: tip.y > at.y };
}

/**
 * The top-left of a box `size` hung from `corner` (page units), kept on
 * the page's top and left.
 */
export function hungBoxOrigin(
  corner: Point,
  size: Size,
  hang: CalloutHang | undefined,
): Point {
  return {
    x: Math.max(0, hang?.left ? corner.x - size.width : corner.x),
    y: Math.max(0, hang?.up ? corner.y - size.height : corner.y),
  };
}

/** Where a callout is: its box and (optional) leader tip, in page units. */
export interface CalloutPlace {
  box: Rect;
  tip: Point | null;
}

/** Callout marks store [x, y, w, h] of the box, then the tip if any (0..1). */
export function calloutPlace(
  mark: Pick<Markup, "points">,
  page: Size,
): CalloutPlace {
  const [x, y, w, h, tx, ty] = mark.points;
  return {
    box: {
      x: x * page.width,
      y: y * page.height,
      width: w * page.width,
      height: h * page.height,
    },
    tip:
      tx === undefined || ty === undefined
        ? null
        : { x: tx * page.width, y: ty * page.height },
  };
}

/** The stored points for a box and tip (page units in). */
export function calloutPoints(place: CalloutPlace, page: Size): number[] {
  const n = (v: number, d: number) => Math.round((v / d) * 1e5) / 1e5;
  const { box, tip } = place;
  return [
    n(box.x, page.width),
    n(box.y, page.height),
    n(box.width, page.width),
    n(box.height, page.height),
    ...(tip ? [n(tip.x, page.width), n(tip.y, page.height)] : []),
  ];
}

export interface CalloutLayout {
  box: Rect;
  metrics: CalloutMetrics;
  /** Text lines with their baseline (page units, y down). */
  lines: { text: string; x: number; baseline: number }[];
  /**
   * The leader (as thick as the box's border): a line from the box to the
   * base of its head, through the dog leg's elbow when it has one.
   */
  leader: { points: Point[]; width: number; head: Point[] } | null;
}

/** The point on a rectangle's edge closest to `p` (outside it). */
function nearestOnBox(box: Rect, p: Point): Point {
  return {
    x: Math.min(box.x + box.width, Math.max(box.x, p.x)),
    y: Math.min(box.y + box.height, Math.max(box.y, p.y)),
  };
}

/** A dog leg's horizontal shoulder, in font sizes (about two letters). */
const SHOULDER_EM = 1.5;

/**
 * The leader's line from the box towards `tip` (engineer, 2026-10-06): a
 * dog leg, drafting style, with a short horizontal shoulder out of the
 * middle of the side facing the tip, then straight to it. A tip above or
 * below the box (within a shoulder of its sides) gets a straight line from
 * the nearest edge instead.
 */
function leaderLine(box: Rect, tip: Point, shoulder: number): Point[] {
  const left = tip.x < box.x - shoulder;
  const right = tip.x > box.x + box.width + shoulder;
  if (!left && !right) return [nearestOnBox(box, tip), tip];
  const y = box.y + box.height / 2;
  const x = left ? box.x : box.x + box.width;
  return [{ x, y }, { x: left ? x - shoulder : x + shoulder, y }, tip];
}

/** The arrowhead on the end of `line`, or null when it's too short for one. */
function withHead(line: Point[], width: number): CalloutLayout["leader"] {
  const tip = line[line.length - 1];
  const from = line[line.length - 2];
  const length = Math.hypot(tip.x - from.x, tip.y - from.y);
  // Head proportions as the arrow shape's, scaled by the border.
  const headLength = width * HEAD_LENGTH;
  if (length <= headLength) return null;
  const ux = (tip.x - from.x) / length;
  const uy = (tip.y - from.y) / length;
  const base = { x: tip.x - ux * headLength, y: tip.y - uy * headLength };
  const half = (headLength * HEAD_WIDTH) / 2;
  return {
    points: [...line.slice(0, -1), base],
    width,
    head: [
      tip,
      { x: base.x - uy * half, y: base.y + ux * half },
      { x: base.x + uy * half, y: base.y - ux * half },
    ],
  };
}

/** Everything needed to draw a callout. */
export function layoutCallout(
  mark: Pick<Markup, "points" | "weight" | "text">,
  page: Size,
  measure: MeasureText,
): CalloutLayout {
  const { box, tip } = calloutPlace(mark, page);
  const metrics = calloutMetrics(mark.weight, page);
  const text = wrapText(
    mark.text ?? "",
    metrics.fontSize,
    box.width - 2 * metrics.inset + 0.5,
    measure,
  );
  const first =
    box.y +
    metrics.inset +
    (metrics.lineHeight - (ASCENT + DESCENT) * metrics.fontSize) / 2 +
    ASCENT * metrics.fontSize;
  const lines = text.map((t, i) => ({
    text: t,
    x: box.x + metrics.inset,
    baseline: first + i * metrics.lineHeight,
  }));
  let leader: CalloutLayout["leader"] = null;
  if (tip) {
    const line = leaderLine(box, tip, metrics.fontSize * SHOULDER_EM);
    // A last leg too short for its head goes straight from the side; a tip
    // inside the box (or right by it) has no leader to draw.
    leader =
      withHead(line, metrics.border) ??
      (line.length > 2 ? withHead([line[0], tip], metrics.border) : null);
  }
  return { box, metrics, lines, leader };
}

/** Points along a callout's box and leader, for the eraser. */
export function calloutOutline(
  mark: Pick<Markup, "points" | "weight">,
  page: Size,
): Point[] {
  const { box, tip } = calloutPlace(mark, page);
  const fontSize = calloutMetrics(mark.weight, page).fontSize;
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
    { x: box.x, y: box.y },
  ];
  return tip
    ? [...leaderLine(box, tip, fontSize * SHOULDER_EM).reverse(), ...corners]
    : corners;
}

/** Whether `p` (page units) is on a callout's box. */
export function insideCallout(
  mark: Pick<Markup, "points">,
  page: Size,
  p: Point,
): boolean {
  const { box } = calloutPlace(mark, page);
  return (
    p.x >= box.x &&
    p.x <= box.x + box.width &&
    p.y >= box.y &&
    p.y <= box.y + box.height
  );
}
