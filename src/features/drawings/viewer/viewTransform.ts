/**
 * Pure geometry for the drawing viewer. "Page units" are PDF points at
 * scale 1; "screen" is CSS pixels relative to the viewer's top-left.
 *   screen = page * scale + (x, y)
 * Pins are stored normalised (0..1 of the page), never in screen pixels.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

export interface ZoomLimits {
  min: number;
  max: number;
}

/** Fits the whole page in the view, centred, with `padding` px around it. */
export function fitTransform(
  page: Size,
  view: Size,
  padding = 16,
): ViewTransform {
  const scale = Math.max(
    0.01,
    Math.min(
      (view.width - 2 * padding) / page.width,
      (view.height - 2 * padding) / page.height,
    ),
  );
  return {
    scale,
    x: (view.width - page.width * scale) / 2,
    y: (view.height - page.height * scale) / 2,
  };
}

/** From half the fit size up to roughly 24x fit (at least 4 px per point). */
export function zoomLimits(fitScale: number): ZoomLimits {
  return { min: fitScale * 0.5, max: Math.max(fitScale * 24, 4) };
}

/** Zooms by `factor` keeping the page point under `at` fixed on screen. */
export function zoomAt(
  t: ViewTransform,
  factor: number,
  at: Point,
  limits: ZoomLimits,
): ViewTransform {
  const scale = Math.min(limits.max, Math.max(limits.min, t.scale * factor));
  const applied = scale / t.scale;
  return {
    scale,
    x: at.x - (at.x - t.x) * applied,
    y: at.y - (at.y - t.y) * applied,
  };
}

export function panBy(t: ViewTransform, dx: number, dy: number): ViewTransform {
  return { ...t, x: t.x + dx, y: t.y + dy };
}

export function screenToPage(t: ViewTransform, p: Point): Point {
  return { x: (p.x - t.x) / t.scale, y: (p.y - t.y) / t.scale };
}

export function pageToScreen(t: ViewTransform, p: Point): Point {
  return { x: p.x * t.scale + t.x, y: p.y * t.scale + t.y };
}

/** Normalised page position under a screen point, or null if off the page. */
export function screenToNormalised(
  t: ViewTransform,
  p: Point,
  page: Size,
): Point | null {
  const q = screenToPage(t, p);
  const n = { x: q.x / page.width, y: q.y / page.height };
  return n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1 ? n : null;
}

export function normalisedToScreen(
  t: ViewTransform,
  n: Point,
  page: Size,
): Point {
  return pageToScreen(t, { x: n.x * page.width, y: n.y * page.height });
}

export function clampNormalised(n: Point): Point {
  return {
    x: Math.min(1, Math.max(0, n.x)),
    y: Math.min(1, Math.max(0, n.y)),
  };
}

/** The part of the page that is on screen, in page units, or null if none. */
export function visiblePageRect(
  t: ViewTransform,
  page: Size,
  view: Size,
): Rect | null {
  const topLeft = screenToPage(t, { x: 0, y: 0 });
  const bottomRight = screenToPage(t, { x: view.width, y: view.height });
  const x = Math.max(0, topLeft.x);
  const y = Math.max(0, topLeft.y);
  const right = Math.min(page.width, bottomRight.x);
  const bottom = Math.min(page.height, bottomRight.y);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}
