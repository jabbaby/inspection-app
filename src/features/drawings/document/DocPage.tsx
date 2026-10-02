import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "../pdf/pdfjs";
import type { Rect } from "../viewer/viewTransform";
import { ViewerCoordsContext, type ViewerCoords } from "../viewer/viewerCoords";
import { visiblePart, type PageLayout } from "./documentLayout";

// iPad Safari limits total canvas memory, and several pages can be live.
const MAX_BASE_PIXELS = 4_000_000;

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

/**
 * One page of the inspection document. Drawn in its own points inside a box
 * scaled to the document width, so overlays (the notes box) use page units.
 * Renders once at fit-width quality while active, then sharpens the visible
 * part after each gesture settles. Releases its canvases when inactive.
 */
export function DocPage({
  page,
  doc,
  active,
  view,
  overlay,
  clientToNormalised,
  onRendered,
  registerRender,
}: Props) {
  const baseHost = useRef<HTMLDivElement>(null);
  const tileHost = useRef<HTMLDivElement>(null);
  const [proxy, setProxy] = useState<PDFPageProxy | null>(null);
  // The pdf.js page whose base render has finished.
  const [renderedProxy, setRenderedProxy] = useState<PDFPageProxy | null>(null);
  const rendered = proxy !== null && renderedProxy === proxy;
  const baseScale = useRef(0);
  const onRenderedRef = useRef(onRendered);
  useEffect(() => {
    onRenderedRef.current = onRendered;
  });

  // Fetch the pdf.js page while active.
  useEffect(() => {
    if (!active || !doc) return;
    let current = true;
    let fetched: PDFPageProxy | null = null;
    void doc.getPage(page.page).then((p) => {
      fetched = p;
      if (current) setProxy(p);
    });
    return () => {
      current = false;
      setProxy(null);
      fetched?.cleanup();
    };
  }, [active, doc, page.page]);

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

  // Release everything when the page goes inactive or unmounts.
  useEffect(() => {
    if (active) return;
    clearHost(baseHost.current);
    clearHost(tileHost.current);
    baseScale.current = 0;
  }, [active]);
  useEffect(() => {
    const base = baseHost.current;
    const tile = tileHost.current;
    return () => {
      clearHost(base);
      clearHost(tile);
    };
  }, []);

  // Sharpen the visible part after each gesture settles.
  const tileTask = useRef<RenderTask | null>(null);
  useEffect(() => {
    tileTask.current?.cancel();
    if (!proxy || !view || !rendered) return;
    const part = visiblePart(page, view.docRect);
    let scale = view.devicePxPerDocUnit * page.scale;
    if (!part || scale <= baseScale.current * 1.1) {
      clearHost(tileHost.current);
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
    const budget = 12_000_000 / Math.max(1, view.visibleCount);
    const area = rect.width * rect.height;
    if (area * scale * scale > budget) scale = Math.sqrt(budget / area);

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(rect.width * scale);
    canvas.height = Math.ceil(rect.height * scale);
    Object.assign(canvas.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    const task = proxy.render({
      canvas,
      viewport: proxy.getViewport({
        scale,
        offsetX: -rect.x * scale,
        offsetY: -rect.y * scale,
      }),
    });
    tileTask.current = task;
    // A pinch cancels it; the next settled view draws it again.
    const unregister = registerRender(() => task.cancel());
    task.promise.then(
      () => {
        unregister();
        if (tileTask.current !== task) return releaseCanvas(canvas);
        clearHost(tileHost.current);
        tileHost.current?.appendChild(canvas);
        tileTask.current = null;
      },
      (error: unknown) => {
        unregister();
        releaseCanvas(canvas);
        if (!isCancel(error)) console.error("Tile render failed", error);
      },
    );
    return () => {
      unregister();
      task.cancel();
    };
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
        {active && (
          <ViewerCoordsContext.Provider value={coords}>
            {overlay}
          </ViewerCoordsContext.Provider>
        )}
      </div>
    </div>
  );
}
