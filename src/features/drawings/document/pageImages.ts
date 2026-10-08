/**
 * Smoother scrolling (step 10b, engineer-agreed 2026-10-08): the iPad
 * diagnostics showed dropped frames came from pages being drawn during a
 * scroll, not from markup. So full-detail page images are drawn one at a
 * time, pages on screen first, only once scrolling stops (a quick
 * low-detail preview stands in meanwhile), and the last few pages' images
 * are kept so scrolling back doesn't draw them again.
 */

// --- recently shown pages' images ------------------------------------------

/** Canvas pixels kept for pages that went off screen (about four A1 pages). */
const KEEP_PIXELS = 16_000_000;

interface Kept {
  canvas: HTMLCanvasElement;
  scale: number;
}

/** Most recently kept last. */
const kept = new Map<string, Kept>();

function keptPixels() {
  let total = 0;
  for (const k of kept.values()) total += k.canvas.width * k.canvas.height;
  return total;
}

function release(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
  canvas.remove();
}

/** Keeps a page's full image as it goes off screen (the oldest go first). */
export function keepPageImage(
  key: string,
  canvas: HTMLCanvasElement,
  scale: number,
) {
  const old = kept.get(key);
  if (old && old.canvas !== canvas) release(old.canvas);
  kept.delete(key);
  canvas.remove();
  kept.set(key, { canvas, scale });
  for (const [k, v] of kept) {
    if (keptPixels() <= KEEP_PIXELS) break;
    kept.delete(k);
    release(v.canvas);
  }
}

/** A kept image drawn at `scale`, handed back to its page (or null). */
export function takePageImage(
  key: string,
  scale: number,
): HTMLCanvasElement | null {
  const k = kept.get(key);
  if (!k) return null;
  kept.delete(key);
  if (Math.abs(k.scale - scale) > scale * 0.01) {
    release(k.canvas);
    return null;
  }
  return k.canvas;
}

/** Lets every kept image go (the drawings screen closed). */
export function clearPageImages() {
  for (const k of kept.values()) release(k.canvas);
  kept.clear();
}

// --- one full-detail drawing at a time ---------------------------------------

interface Job {
  /** 0 for a page on screen, 1 for one just off it. */
  priority: number;
  order: number;
  run: (done: () => void) => () => void;
  cancel: (() => void) | null;
}

const waiting: Job[] = [];
let running: Job | null = null;
let counter = 0;

function next() {
  if (running || waiting.length === 0) return;
  waiting.sort((a, b) => a.priority - b.priority || a.order - b.order);
  const job = waiting.shift()!;
  running = job;
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    if (running === job) running = null;
    next();
  };
  job.cancel = job.run(done);
}

/**
 * Queues a full-detail page drawing. `run` starts it, calls `done` when it
 * ends either way, and returns a way to stop it. The result cancels it,
 * whether waiting or running.
 */
export function queuePageDrawing(
  priority: number,
  run: (done: () => void) => () => void,
): () => void {
  const job: Job = { priority, order: counter++, run, cancel: null };
  waiting.push(job);
  queueMicrotask(next);
  return () => {
    const i = waiting.indexOf(job);
    if (i >= 0) waiting.splice(i, 1);
    if (running === job) {
      running = null;
      job.cancel?.();
      next();
    }
  };
}
