import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PDFPageProxy, RenderTask } from "../pdf/pdfjs";
import {
  clampNormalised,
  clampTransform,
  fitTransform,
  normalisedToScreen,
  panBy,
  screenToNormalised,
  screenToPage,
  visiblePageRect,
  zoomAt,
  zoomLimits,
  type Point,
  type Rect,
  type Size,
  type ViewTransform,
} from "./viewTransform";

export interface ViewerPin {
  id: string;
  letter: string;
  /** Normalised page position (0..1). */
  x: number;
  y: number;
}

export interface ViewerStats {
  pageWidth: number;
  pageHeight: number;
  baseMs: number;
  basePixels: number;
  tileMs?: number;
  tilePixels?: number;
  /** Zoom relative to "fit page". */
  zoom: number;
}

interface Props {
  page: PDFPageProxy;
  pins: ViewerPin[];
  /** While true, the next tap (finger, Pencil or mouse) places a pin. */
  addPinMode: boolean;
  onPlacePin: (at: Point) => void;
  onMovePin: (id: string, to: Point) => void;
  onStats?: (stats: ViewerStats) => void;
  /** Change this number to fit the page to the view again. */
  fitRequest?: number;
}

// iPad Safari limits canvas memory; stay well inside it.
const MAX_BASE_PIXELS = 6_000_000;
const MAX_TILE_PIXELS = 12_000_000;
const TAP_SLOP = 10;
const TAP_MS = 600;
const SETTLE_MS = 160;

interface Tracked extends Point {
  type: string;
}

function isCancel(error: unknown): boolean {
  return error instanceof Error && error.name === "RenderingCancelledException";
}

/** Pointer capture throws if the pointer has already gone; that is harmless. */
function capture(e: React.PointerEvent) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // Pointer already released.
  }
}

/** Frees a canvas's backing memory straight away (important on iOS). */
function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
  canvas.remove();
}

/**
 * Shows one PDF page with GoodNotes-style navigation: one finger pans, two
 * fingers pinch-zoom, the mouse drags and wheel/trackpad zooms. Apple Pencil
 * input is ignored (reserved for markup) except while placing a pin.
 *
 * The page is rendered once at "fit" resolution; gestures move that canvas
 * with a CSS transform, then the visible area is re-rendered sharp.
 */
export function DrawingViewer(props: Props) {
  const { page, pins, addPinMode, fitRequest } = props;
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseHostRef = useRef<HTMLDivElement>(null);
  const tileHostRef = useRef<HTMLDivElement>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());

  const pageSize = useMemo<Size>(() => {
    const vp = page.getViewport({ scale: 1 });
    return { width: vp.width, height: vp.height };
  }, [page]);

  const transform = useRef<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const viewSize = useRef<Size>({ width: 0, height: 0 });
  const fitScale = useRef(1);
  const baseRenderScale = useRef(0);
  const stats = useRef<ViewerStats | null>(null);
  // The page whose first render has finished (drives data-ready for tests).
  const [renderedPage, setRenderedPage] = useState<PDFPageProxy | null>(null);

  const frame = useRef(0);
  const settleTimer = useRef(0);
  const tileTask = useRef<RenderTask | null>(null);

  // --- layout -------------------------------------------------------------

  function layout() {
    frame.current = 0;
    const t = transform.current;
    const stage = stageRef.current;
    if (stage) {
      stage.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
    }
    for (const pin of latest.current.pins) {
      const el = pinEls.current.get(pin.id);
      if (!el) continue;
      const p = normalisedToScreen(t, pin, pageSize);
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  }

  function requestLayout() {
    if (!frame.current) frame.current = requestAnimationFrame(layout);
  }

  function reportStats(update: Partial<ViewerStats>) {
    if (!stats.current) return;
    stats.current = {
      ...stats.current,
      ...update,
      zoom: transform.current.scale / fitScale.current,
    };
    latest.current.onStats?.(stats.current);
  }

  function setTransform(next: ViewTransform) {
    transform.current = clampTransform(next, pageSize, viewSize.current);
    requestLayout();
    tileTask.current?.cancel();
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(renderTile, SETTLE_MS);
  }

  function fit() {
    const fitted = fitTransform(pageSize, viewSize.current);
    fitScale.current = fitted.scale;
    setTransform(fitted);
  }

  // --- rendering ----------------------------------------------------------

  function clearTile() {
    tileTask.current?.cancel();
    tileTask.current = null;
    tileHostRef.current
      ?.querySelectorAll("canvas")
      .forEach((c) => releaseCanvas(c));
  }

  /** Re-renders the visible part of the page at screen resolution. */
  function renderTile() {
    tileTask.current?.cancel();
    const t = transform.current;
    const dpr = window.devicePixelRatio || 1;
    const visible = visiblePageRect(t, pageSize, viewSize.current);
    let scale = t.scale * dpr;
    if (!visible || scale <= baseRenderScale.current * 1.1) {
      clearTile();
      reportStats({ tileMs: undefined, tilePixels: undefined });
      return;
    }
    // A little extra around the edges so small pans stay sharp.
    const pad = 40 / t.scale;
    const rect: Rect = {
      x: Math.max(0, visible.x - pad),
      y: Math.max(0, visible.y - pad),
      width: 0,
      height: 0,
    };
    rect.width =
      Math.min(pageSize.width, visible.x + visible.width + pad) - rect.x;
    rect.height =
      Math.min(pageSize.height, visible.y + visible.height + pad) - rect.y;
    const area = rect.width * rect.height;
    if (area * scale * scale > MAX_TILE_PIXELS) {
      scale = Math.sqrt(MAX_TILE_PIXELS / area);
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(rect.width * scale);
    canvas.height = Math.ceil(rect.height * scale);
    Object.assign(canvas.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    const viewport = page.getViewport({
      scale,
      offsetX: -rect.x * scale,
      offsetY: -rect.y * scale,
    });
    const started = performance.now();
    const task = page.render({ canvas, viewport });
    tileTask.current = task;
    task.promise.then(
      () => {
        if (tileTask.current !== task) return releaseCanvas(canvas);
        const host = tileHostRef.current;
        host?.querySelectorAll("canvas").forEach((c) => releaseCanvas(c));
        host?.appendChild(canvas);
        tileTask.current = null;
        reportStats({
          tileMs: Math.round(performance.now() - started),
          tilePixels: canvas.width * canvas.height,
        });
      },
      (error: unknown) => {
        releaseCanvas(canvas);
        if (!isCancel(error)) console.error("Tile render failed", error);
      },
    );
  }

  // Base render whenever the page changes.
  useEffect(() => {
    const container = containerRef.current!;
    const box = container.getBoundingClientRect();
    viewSize.current = { width: box.width, height: box.height };
    const fitted = fitTransform(pageSize, viewSize.current);
    fitScale.current = fitted.scale;
    transform.current = fitted;
    layout();

    const dpr = window.devicePixelRatio || 1;
    const area = pageSize.width * pageSize.height;
    const scale = Math.min(
      fitted.scale * dpr,
      Math.sqrt(MAX_BASE_PIXELS / area),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(pageSize.width * scale);
    canvas.height = Math.round(pageSize.height * scale);
    canvas.className = "viewer-base";

    const started = performance.now();
    const task = page.render({ canvas, viewport: page.getViewport({ scale }) });
    let current = true;
    task.promise.then(
      () => {
        if (!current) return releaseCanvas(canvas);
        const host = baseHostRef.current!;
        host.querySelectorAll("canvas").forEach((c) => releaseCanvas(c));
        host.appendChild(canvas);
        baseRenderScale.current = scale;
        stats.current = {
          pageWidth: pageSize.width,
          pageHeight: pageSize.height,
          baseMs: Math.round(performance.now() - started),
          basePixels: canvas.width * canvas.height,
          zoom: 1,
        };
        latest.current.onStats?.(stats.current);
        setRenderedPage(page);
      },
      (error: unknown) => {
        releaseCanvas(canvas);
        if (!isCancel(error)) console.error("Page render failed", error);
      },
    );

    return () => {
      current = false;
      task.cancel();
      clearTile();
      window.clearTimeout(settleTimer.current);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
    // layout/clearTile only read refs; re-running on page change is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // Release the base canvas when the viewer goes away.
  useEffect(() => {
    const host = baseHostRef.current;
    return () =>
      host?.querySelectorAll("canvas").forEach((c) => releaseCanvas(c));
  }, []);

  // Fit on request (toolbar button).
  useEffect(() => {
    if (fitRequest) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);

  // Keep pins positioned when they change.
  useLayoutEffect(() => {
    layout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins]);

  // Follow container size changes (rotation, split view).
  useEffect(() => {
    const container = containerRef.current!;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (
        width === viewSize.current.width &&
        height === viewSize.current.height
      )
        return;
      const wasFit =
        Math.abs(transform.current.scale - fitScale.current) < 1e-6;
      viewSize.current = { width, height };
      const fitted = fitTransform(pageSize, viewSize.current);
      fitScale.current = fitted.scale;
      setTransform(wasFit ? fitted : transform.current);
    });
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // --- input --------------------------------------------------------------

  const pointers = useRef(new Map<number, Tracked>());
  const tap = useRef<{ id: number; start: Point; time: number } | null>(null);
  const pinch = useRef<{ dist: number; mid: Point } | null>(null);
  const dragging = useRef<{ id: string; pointerId: number } | null>(null);

  function local(e: { clientX: number; clientY: number }): Point {
    const box = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }

  function touchPair(): [Tracked, Tracked] | null {
    const list = [...pointers.current.values()].filter((p) => p.type !== "pen");
    return list.length >= 2 ? [list[0], list[1]] : null;
  }

  function startPinch() {
    const pair = touchPair();
    pinch.current = pair
      ? {
          dist: Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y),
          mid: {
            x: (pair[0].x + pair[1].x) / 2,
            y: (pair[0].y + pair[1].y) / 2,
          },
        }
      : null;
  }

  function onPointerDown(e: React.PointerEvent) {
    // Pencil is reserved for markup; it only acts while placing a pin.
    if (e.pointerType === "pen" && !latest.current.addPinMode) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    capture(e);
    const p = local(e);
    pointers.current.set(e.pointerId, { ...p, type: e.pointerType });
    tileTask.current?.cancel();
    if (pointers.current.size === 1) {
      tap.current = { id: e.pointerId, start: p, time: e.timeStamp };
    } else {
      tap.current = null;
      startPinch();
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, { ...p, type: prev.type });

    const pair = touchPair();
    if (pair && pinch.current) {
      const dist = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      const mid = {
        x: (pair[0].x + pair[1].x) / 2,
        y: (pair[0].y + pair[1].y) / 2,
      };
      const limits = zoomLimits(fitScale.current);
      let next = zoomAt(
        transform.current,
        dist / pinch.current.dist,
        mid,
        limits,
      );
      next = panBy(
        next,
        mid.x - pinch.current.mid.x,
        mid.y - pinch.current.mid.y,
      );
      pinch.current = { dist, mid };
      setTransform(next);
      return;
    }
    if (prev.type === "pen" || pointers.current.size !== 1) return;

    const pending = tap.current;
    if (pending && pending.id === e.pointerId) {
      // Don't move the page until it's clearly a drag, then catch up.
      if (Math.hypot(p.x - pending.start.x, p.y - pending.start.y) < TAP_SLOP)
        return;
      tap.current = null;
      setTransform(
        panBy(transform.current, p.x - pending.start.x, p.y - pending.start.y),
      );
      return;
    }
    setTransform(panBy(transform.current, p.x - prev.x, p.y - prev.y));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const pending = tap.current;
    tap.current = null;
    if (
      e.type === "pointerup" &&
      pending?.id === e.pointerId &&
      e.timeStamp - pending.time < TAP_MS &&
      latest.current.addPinMode
    ) {
      const at = screenToNormalised(transform.current, local(e), pageSize);
      if (at) latest.current.onPlacePin(at);
    }
    if (touchPair()) startPinch();
    else pinch.current = null;
  }

  // Wheel: trackpad pinch / ctrl+wheel zooms, plain wheel pans. Needs a
  // non-passive listener to stop the page scrolling.
  useEffect(() => {
    const container = containerRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const limits = zoomLimits(fitScale.current);
        setTransform(
          zoomAt(
            transform.current,
            Math.exp(-e.deltaY * 0.01),
            local(e),
            limits,
          ),
        );
      } else {
        setTransform(panBy(transform.current, -e.deltaX, -e.deltaY));
      }
    };
    // Safari's own pinch-zoom of the whole page.
    const stopGesture = (e: Event) => e.preventDefault();
    container.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("gesturestart", stopGesture);
    document.addEventListener("gesturechange", stopGesture);
    return () => {
      container.removeEventListener("wheel", onWheel);
      document.removeEventListener("gesturestart", stopGesture);
      document.removeEventListener("gesturechange", stopGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // --- pins ---------------------------------------------------------------

  function onPinPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    capture(e);
    dragging.current = { id, pointerId: e.pointerId };
  }

  function onPinPointerMove(e: React.PointerEvent) {
    const drag = dragging.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const q = screenToPage(transform.current, local(e));
    latest.current.onMovePin(
      drag.id,
      clampNormalised({ x: q.x / pageSize.width, y: q.y / pageSize.height }),
    );
  }

  function onPinPointerUp(e: React.PointerEvent) {
    if (dragging.current?.pointerId === e.pointerId) dragging.current = null;
  }

  return (
    <div
      ref={containerRef}
      className={`viewer${addPinMode ? " viewer-add-pin" : ""}`}
      data-testid="drawing-viewer"
      data-ready={renderedPage === page}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={stageRef}
        className="viewer-stage"
        data-testid="viewer-stage"
        style={{ width: pageSize.width, height: pageSize.height }}
      >
        <div ref={baseHostRef} className="viewer-layer" />
        <div ref={tileHostRef} className="viewer-layer" />
      </div>
      <div className="viewer-pins">
        {pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            className="viewer-pin"
            data-testid="viewer-pin"
            data-letter={pin.letter}
            data-x={pin.x.toFixed(4)}
            data-y={pin.y.toFixed(4)}
            aria-label={`Pin ${pin.letter}`}
            ref={(el) => {
              if (el) pinEls.current.set(pin.id, el);
              else pinEls.current.delete(pin.id);
            }}
            onPointerDown={(e) => onPinPointerDown(e, pin.id)}
            onPointerMove={onPinPointerMove}
            onPointerUp={onPinPointerUp}
            onPointerCancel={onPinPointerUp}
          >
            {pin.letter}
          </button>
        ))}
      </div>
    </div>
  );
}
