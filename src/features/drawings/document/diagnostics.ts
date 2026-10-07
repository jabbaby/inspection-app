/**
 * Drawing viewer diagnostics (step 10): what each page on screen was drawn
 * at, against what it wanted, plus render errors, scroll smoothness and
 * PDF open times, for the panel the engineer can screenshot or copy from
 * the iPad (there is no Web Inspector without a Mac). A plain module the
 * viewer writes to and the panel reads every half second; it holds only
 * numbers and page numbers, never drawing names.
 */

/** One render of a page: device pixels per PDF point, and what it cost. */
export interface RenderStat {
  scale: number;
  /** The scale the view asked for. */
  wanted: number;
  /** Why it got less: the base image's pixel cap, or the sharp budget. */
  limit: "cap" | "budget" | null;
  /** Canvas pixels. */
  pixels: number;
  /** How long pdf.js took (until now, while drawing). */
  ms: number;
  state: "drawing" | "done" | "cancelled" | "failed";
  /** When it started (performance.now()). */
  started: number;
}

export interface PageStat {
  drawingId: string;
  /** Page number through the document. */
  number: number;
  widthPt: number;
  heightPt: number;
  base: RenderStat | null;
  /** The sharp render of the visible part; null when the base is enough. */
  sharp: RenderStat | null;
}

export interface ViewStat {
  /** Zoom as a multiple of fit width. */
  zoom: number;
  dpr: number;
  /** Pages on screen, in order. */
  visibleKeys: string[];
}

export interface ScrollStat {
  seconds: number;
  fps: number;
  worstMs: number;
}

export interface DiagnosticsState {
  /** True while the panel is showing (scroll timing runs only then). */
  enabled: boolean;
  pages: Map<string, PageStat>;
  view: ViewStat | null;
  scroll: ScrollStat | null;
  /** Per drawing: how long its PDF took to open, and its size. */
  pdfs: Map<string, { ms: number; bytes: number }>;
  /** The latest render errors, newest last. */
  errors: { time: number; message: string }[];
}

export const diagnostics: DiagnosticsState = {
  enabled: false,
  pages: new Map(),
  view: null,
  scroll: null,
  pdfs: new Map(),
  errors: [],
};

const MAX_ERRORS = 5;

/** Notes a render (or PDF) error, kept even while the panel is hidden. */
export function recordError(what: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  diagnostics.errors.push({ time: Date.now(), message: `${what}: ${message}` });
  if (diagnostics.errors.length > MAX_ERRORS) diagnostics.errors.shift();
}

/** The page's record, created on first use. */
export function pageStat(
  key: string,
  drawingId: string,
  number: number,
  widthPt: number,
  heightPt: number,
): PageStat {
  let stat = diagnostics.pages.get(key);
  if (!stat) {
    stat = { drawingId, number, widthPt, heightPt, base: null, sharp: null };
    diagnostics.pages.set(key, stat);
  }
  stat.number = number;
  return stat;
}

/** A render starting now. */
export function startRender(
  scale: number,
  wanted: number,
  limit: RenderStat["limit"],
  pixels: number,
): RenderStat {
  return {
    scale,
    wanted,
    limit,
    pixels,
    ms: 0,
    state: "drawing",
    started: performance.now(),
  };
}

/** Marks a render finished (or cancelled, or failed). */
export function endRender(stat: RenderStat, state: RenderStat["state"]) {
  stat.state = state;
  stat.ms = performance.now() - stat.started;
}

// --- scroll smoothness ----------------------------------------------------

/** A scroll counts as over this long after its last scroll event. */
const SCROLL_END_MS = 250;

let scrolling: {
  start: number;
  last: number;
  lastEvent: number;
  frames: number;
  worst: number;
} | null = null;

function scrollFrame(now: number) {
  const s = scrolling;
  if (!s) return;
  s.worst = Math.max(s.worst, now - s.last);
  s.last = now;
  s.frames += 1;
  if (now - s.lastEvent > SCROLL_END_MS) {
    // Over: the frames up to the last scroll event.
    const seconds = (s.lastEvent - s.start) / 1000;
    if (seconds > 0.1)
      diagnostics.scroll = {
        seconds,
        fps: s.frames / ((now - s.start) / 1000),
        worstMs: s.worst,
      };
    scrolling = null;
    return;
  }
  requestAnimationFrame(scrollFrame);
}

/** The document scrolled: times the frames while it keeps scrolling. */
export function noteScroll() {
  if (!diagnostics.enabled) return;
  const now = performance.now();
  if (scrolling) {
    scrolling.lastEvent = now;
    return;
  }
  scrolling = { start: now, last: now, lastEvent: now, frames: 0, worst: 0 };
  requestAnimationFrame(scrollFrame);
}
