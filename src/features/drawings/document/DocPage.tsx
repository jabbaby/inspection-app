import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { markPath, markStyle } from "../../markup/markGeometry";
import type { DocMark } from "../../markup/tools";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "../pdf/pdfjs";
import type { Rect } from "../viewer/viewTransform";
import { ViewerCoordsContext, type ViewerCoords } from "../viewer/viewerCoords";
import { visiblePart, type PageLayout } from "./documentLayout";

// iPad Safari limits total canvas memory, and several pages can be live.
const MAX_BASE_PIXELS = 4_000_000;
/** Pixels for the sharp part on screen, shared by the pages showing. */
const TILE_PIXELS = 12_000_000;

export interface SettledView {
  /** Visible document rectangle (document units). */
  docRect: Rect;
  /** Device pixels per document unit at the current zoom. */
  devicePxPerDocUnit: number;
  /** Device pixels per document unit at "fit width" (base render quality). */
  fitDevicePxPerDocUnit: number;
  /** Number of pages on screen, to share the sharp-render pixel budget. */
  visibleCount: number;
}

interface Props {
  page: PageLayout;
  doc: PDFDocumentProxy | undefined;
  /** On or near the screen: render it. Otherwise release its memory. */
  active: boolean;
  view: SettledView | null;
  /** The page's pen and highlighter marks (painted into canvases). */
  marks: DocMark[];
  overlay?: ReactNode;
  clientToNormalised: (
    clientX: number,
    clientY: number,
  ) => { x: number; y: number };
  onRendered: (key: string) => void;
  /**
   * Registers a way to cancel the sharp render in progress (a pinch pauses
   * drawing); returns the unregister function.
   */
  registerRender: (cancel: () => void) => () => void;
}

function isCancel(error: unknown): boolean {
  return error instanceof Error && error.name === "RenderingCancelledException";
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
  canvas.remove();
}

function clearHost(host: HTMLElement | null) {
  host?.querySelectorAll("canvas").forEach((c) => releaseCanvas(c));
}

/** The host's canvas (made once), sized in device pixels. */
function hostCanvas(host: HTMLElement, width: number, height: number) {
  let canvas = host.querySelector("canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    host.appendChild(canvas);
  }
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return canvas;
}

/** Paints marks (page units) for the part `rect` of the page at `scale`. */
function paintMarks(
  canvas: HTMLCanvasElement,
  marks: DocMark[],
  page: PageLayout,
  rect: Rect,
  scale: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const mark of marks) {
    const style = markStyle(mark, page.size);
    ctx.globalAlpha = style.opacity;
    ctx.strokeStyle = style.colour;
    ctx.lineWidth = style.width;
    ctx.stroke(new Path2D(markPath(mark, page.size)));
  }
}

/**
 * One page of the inspection document. Drawn in its own points inside a box
 * scaled to the document width, so overlays (the notes box) use page units.
 * Renders once at fit-width quality while active, then sharpens the visible
 * part after each gesture settles. Releases its canvases when inactive.
 *
 * Pen and highlighter marks are painted into canvases the same way (the
 * whole page at base quality, and the sharp part), not drawn as SVG: Safari
 * repaints SVG paths into every tile that scrolls into view, which made
 * pages with markup slow to appear.
 */
export function DocPage({
  page,
  doc,
  active,
  view,
  marks,
  overlay,
  clientToNormalised,
  onRendered,
  registerRender,
}: Props) {
  const baseHost = useRef<HTMLDivElement>(null);
  const tileHost = useRef<HTMLDivElement>(null);
  const markBaseHost = useRef<HTMLDivElement>(null);
  const markTileHost = useRef<HTMLDivElement>(null);
  /** The sharp part on show (page units) and its scale, for its marks. */
  const tileArea = useRef<{ rect: Rect; scale: number } | null>(null);
  const marksRef = useRef(marks);
  useEffect(() => {
    marksRef.current = marks;
  });
  const [proxy, setProxy] = useState<PDFPageProxy | null>(null);
  // The pdf.js page whose base render has finished.
  const [renderedProxy, setRenderedProxy] = useState<PDFPageProxy | null>(null);
  const rendered = proxy !== null && renderedProxy === proxy;
  const baseScale = useRef(0);

  /**
   * Paints the marks: the whole page at base quality (less the sharp part,
   * so see-through highlights aren't drawn twice there), and the sharp part.
   */
  function repaintMarks() {
    const list = marksRef.current;
    const baseHostEl = markBaseHost.current;
    const tileHostEl = markTileHost.current;
    if (!baseHostEl || !tileHostEl) return;
    const scale = baseScale.current;
    if (list.length === 0 || !scale) {
      clearHost(baseHostEl);
      clearHost(tileHostEl);
      return;
    }
    const { width, height } = page.size;
    const base = hostCanvas(
      baseHostEl,
      Math.round(width * scale),
      Math.round(height * scale),
    );
    base.className = "viewer-base";
    paintMarks(base, list, page, { x: 0, y: 0, width, height }, scale);
    const tile = tileArea.current;
    if (!tile) return clearHost(tileHostEl);
    base
      .getContext("2d")
      ?.clearRect(tile.rect.x, tile.rect.y, tile.rect.width, tile.rect.height);
    const sharp = hostCanvas(
      tileHostEl,
      Math.ceil(tile.rect.width * tile.scale),
      Math.ceil(tile.rect.height * tile.scale),
    );
    Object.assign(sharp.style, {
      left: `${tile.rect.x}px`,
      top: `${tile.rect.y}px`,
      width: `${tile.rect.width}px`,
      height: `${tile.rect.height}px`,
    });
    paintMarks(sharp, list, page, tile.rect, tile.scale);
  }

  const onRenderedRef = useRef(onRendered);
  useEffect(() => {
    onRenderedRef.current = onRendered;
  });

  // Fetch the pdf.js page while active.
  useEffect(() => {
    if (!active || !doc) return;
    let current = true;
    let fetched: PDFPageProxy | null = null;
    void doc.getPage(page.source).then((p) => {
      fetched = p;
      if (current) setProxy(p);
    });
    return () => {
      current = false;
      setProxy(null);
      fetched?.cleanup();
    };
  }, [active, doc, page.source]);

  const fitQuality = view?.fitDevicePxPerDocUnit ?? 0;

  // Base render at fit-width quality.
  useEffect(() => {
    if (!proxy || !fitQuality) return;
    const area = page.size.width * page.size.height;
    const scale = Math.min(
      fitQuality * page.scale,
      Math.sqrt(MAX_BASE_PIXELS / area),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(page.size.width * scale);
    canvas.height = Math.round(page.size.height * scale);
    canvas.className = "viewer-base";
    const task = proxy.render({
      canvas,
      viewport: proxy.getViewport({ scale }),
    });
    let current = true;
    task.promise.then(
      () => {
        if (!current) return releaseCanvas(canvas);
        clearHost(baseHost.current);
        baseHost.current?.appendChild(canvas);
        baseScale.current = scale;
        setRenderedProxy(proxy);
        onRenderedRef.current(page.key);
      },
      (error: unknown) => {
        releaseCanvas(canvas);
        if (!isCancel(error)) console.error("Page render failed", error);
      },
    );
    return () => {
      current = false;
      task.cancel();
    };
    // Re-render only when the page or its quality target changes.
  }, [
    proxy,
    fitQuality,
    page.key,
    page.scale,
    page.size.width,
    page.size.height,
  ]);

  // Marks: repainted when they change and once the base render is in.
  useEffect(() => {
    if (rendered) repaintMarks();
    // repaintMarks reads refs; these are what change what it paints.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, rendered, fitQuality]);

  // Release everything when the page goes inactive or unmounts.
  useEffect(() => {
    if (active) return;
    clearHost(baseHost.current);
    clearHost(tileHost.current);
    clearHost(markBaseHost.current);
    clearHost(markTileHost.current);
    tileArea.current = null;
    baseScale.current = 0;
  }, [active]);
  useEffect(() => {
    const hosts = [
      baseHost.current,
      tileHost.current,
      markBaseHost.current,
      markTileHost.current,
    ];
    return () => hosts.forEach(clearHost);
  }, []);

  // Sharpen the visible part after each gesture settles.
  const tileTask = useRef<RenderTask | null>(null);
  useEffect(() => {
    tileTask.current?.cancel();
    if (!proxy || !view || !rendered) return;
    const part = visiblePart(page, view.docRect);
    const scale = view.devicePxPerDocUnit * page.scale;
    if (!part || scale <= baseScale.current * 1.1) {
      clearHost(tileHost.current);
      if (tileArea.current) {
        tileArea.current = null;
        repaintMarks();
      }
      return;
    }
    const pad = 40 / (view.devicePxPerDocUnit * page.scale);
    const rect: Rect = {
      x: Math.max(0, part.x - pad),
      y: Math.max(0, part.y - pad),
      width: 0,
      height: 0,
    };
    rect.width = Math.min(page.size.width, part.x + part.width + pad) - rect.x;
    rect.height =
      Math.min(page.size.height, part.y + part.height + pad) - rect.y;
    // The sharp layers share one pixel budget (iPad Safari caps total
    // canvas memory; past it, new canvases silently fail and the page stays
    // blurry): a page with marks has two, the drawing's and the marks'.
    // Even halved it is more than the screen's own pixels.
    const layers = marksRef.current.length > 0 ? 2 : 1;
    const budget = TILE_PIXELS / layers / Math.max(1, view.visibleCount);
    const area = rect.width * rect.height;
    const target = scale;

    let task: RenderTask | null = null;
    let unregister = () => {};
    const start = (pixels: number, retry: boolean) => {
      const tileScale =
        area * target * target > pixels ? Math.sqrt(pixels / area) : target;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(rect.width * tileScale);
      canvas.height = Math.ceil(rect.height * tileScale);
      Object.assign(canvas.style, {
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      const current = proxy.render({
        canvas,
        viewport: proxy.getViewport({
          scale: tileScale,
          offsetX: -rect.x * tileScale,
          offsetY: -rect.y * tileScale,
        }),
      });
      task = current;
      tileTask.current = current;
      // A pinch cancels it; the next settled view draws it again.
      unregister = registerRender(() => current.cancel());
      current.promise.then(
        () => {
          unregister();
          if (tileTask.current !== current) return releaseCanvas(canvas);
          clearHost(tileHost.current);
          tileHost.current?.appendChild(canvas);
          tileTask.current = null;
          tileArea.current = { rect, scale: tileScale };
          repaintMarks();
        },
        (error: unknown) => {
          unregister();
          releaseCanvas(canvas);
          if (isCancel(error) || tileTask.current !== current) return;
          console.error("Tile render failed", error);
          // Out of canvas memory, most likely: once more, smaller.
          if (retry) start(pixels / 4, false);
        },
      );
    };
    start(budget, true);
    return () => {
      unregister();
      task?.cancel();
    };
    // repaintMarks reads refs (the marks have their own effect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxy, view, rendered, page, registerRender]);

  const coords = useMemo<ViewerCoords>(
    () => ({ pageSize: page.size, clientToNormalised }),
    [page.size, clientToNormalised],
  );

  return (
    <div
      className="doc-page"
      data-testid="doc-page"
      data-key={page.key}
      data-rendered={rendered}
      style={{ top: page.top, height: page.height }}
    >
      <div
        className="doc-page-inner"
        data-testid="viewer-stage"
        style={{
          width: page.size.width,
          height: page.size.height,
          transform: `scale(${page.scale})`,
        }}
      >
        <div ref={baseHost} className="viewer-layer" />
        <div ref={tileHost} className="viewer-layer" />
        {/* Marks over the drawing, under the arrows, notes box and pins. */}
        <div ref={markBaseHost} className="viewer-layer viewer-marks" />
        <div ref={markTileHost} className="viewer-layer viewer-marks" />
        {marks.length > 0 && (
          // What's painted, for tests and assistive tech to read.
          <ul hidden data-testid="page-marks">
            {marks.map((m) => (
              <li
                key={m.id}
                data-testid="mark"
                data-tool={m.tool}
                data-colour={m.colour}
              />
            ))}
          </ul>
        )}
        {active && (
          <ViewerCoordsContext.Provider value={coords}>
            {overlay}
          </ViewerCoordsContext.Provider>
        )}
      </div>
    </div>
  );
}
