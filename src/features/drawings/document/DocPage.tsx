import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "../pdf/pdfjs";
import type { Rect } from "../viewer/viewTransform";
import { ViewerCoordsContext, type ViewerCoords } from "../viewer/viewerCoords";
import {
  diagnostics,
  endRender,
  pageStat,
  recordError,
  startRender,
} from "./diagnostics";
import { visiblePart, type PageLayout } from "./documentLayout";
import {
  baseTarget,
  keepPageImage,
  queuePageDrawing,
  takePageImage,
} from "./pageImages";
import { loadSavedPage, savePageSoon } from "./savedPages";
/** A preview while scrolling: this fraction of the base's width (1/16 the pixels). */
const PREVIEW_FRACTION = 0.25;

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
  /**
   * The document is scrolling or zooming: no full-detail drawing starts
   * (a quick preview stands in) until it stops (step 10b).
   */
  moving: boolean;
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

/** The kept-images key: the page's place and the PDF page it shows. */
const imageKey = (page: PageLayout) => `${page.key}@${page.source}`;

/**
 * One page of the inspection document. Drawn in its own points inside a box
 * scaled to the document width, so overlays (the notes box) use page units.
 * While active it shows a quick preview, then (once scrolling stops, one
 * page at a time, pages on screen first) its base image at fit-width
 * quality, then sharpens the visible part after each gesture settles. Its
 * base image is kept for a while when it goes off screen (pageImages.ts).
 */
export function DocPage({
  page,
  doc,
  active,
  view,
  moving,
  overlay,
  clientToNormalised,
  onRendered,
  registerRender,
}: Props) {
  const baseHost = useRef<HTMLDivElement>(null);
  const tileHost = useRef<HTMLDivElement>(null);
  const [proxy, setProxy] = useState<PDFPageProxy | null>(null);
  // The pdf.js page whose full base image is showing.
  const [renderedProxy, setRenderedProxy] = useState<PDFPageProxy | null>(null);
  const rendered = proxy !== null && renderedProxy === proxy;
  // The pdf.js page for which no saved image was found (so it's drawn).
  const [savedChecked, setSavedChecked] = useState<PDFPageProxy | null>(null);
  const noSavedImage = proxy !== null && savedChecked === proxy;
  /** The full base image's scale (0 while only a preview, or nothing, shows). */
  const baseScale = useRef(0);
  const onRenderedRef = useRef(onRendered);
  const viewRef = useRef(view);
  useEffect(() => {
    onRenderedRef.current = onRendered;
    viewRef.current = view;
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
      // pdf.js hands back the same page object next time: its image is
      // gone, so it must be shown again.
      setRenderedProxy(null);
      setSavedChecked(null);
      fetched?.cleanup();
    };
  }, [active, doc, page.source]);

  const fitQuality = view?.fitDevicePxPerDocUnit ?? 0;

  /** Shows a finished full base image (replacing any preview). */
  function showBase(
    canvas: HTMLCanvasElement,
    scale: number,
    shown: PDFPageProxy,
  ) {
    clearHost(baseHost.current);
    baseHost.current?.appendChild(canvas);
    baseScale.current = scale;
    setRenderedProxy(shown);
    onRenderedRef.current(page.key);
  }

  // The full base image at fit-width quality: kept from earlier, or its
  // saved image (savedPages.ts), else drawn once the document stops moving,
  // one page at a time, then saved.
  useEffect(() => {
    if (!proxy || !fitQuality || rendered) return;
    const target = baseTarget(page.size, page.scale, fitQuality);
    const { wanted, scale } = target;
    const limit = scale < wanted * 0.999 ? "cap" : null;
    const stat = pageStat(
      page.key,
      page.drawingId,
      page.number,
      page.size.width,
      page.size.height,
    );
    const kept = takePageImage(imageKey(page), scale);
    if (kept) {
      stat.base = startRender(
        scale,
        wanted,
        limit,
        kept.width * kept.height,
        "base",
        true,
      );
      // Shown straight after this effect; the preview needn't start.
      baseScale.current = scale;
      let current = true;
      queueMicrotask(() => {
        if (current) showBase(kept, scale, proxy);
        else keepPageImage(imageKey(page), kept, scale);
      });
      return () => {
        current = false;
      };
    }
    if (!noSavedImage) {
      // Looked for even while scrolling: no PDF drawing, decoded off the
      // main thread.
      const diag = startRender(
        scale,
        wanted,
        limit,
        target.width * target.height,
        "saved image",
      );
      stat.base = diag;
      let current = true;
      loadSavedPage(page.drawingId, page.source, target.width, target.height)
        .then((canvas) => {
          if (!current) {
            if (canvas) releaseCanvas(canvas);
            return endRender(diag, "cancelled");
          }
          if (canvas) {
            canvas.className = "viewer-base";
            endRender(diag, "saved");
            return showBase(canvas, scale, proxy);
          }
          endRender(diag, "cancelled");
          stat.base = null;
          setSavedChecked(proxy);
        })
        .catch((error: unknown) => {
          endRender(diag, "failed");
          recordError(`Page ${page.number} saved image failed`, error);
          if (current) setSavedChecked(proxy);
        });
      return () => {
        current = false;
      };
    }
    if (moving) return;
    // Pages on screen first, then the ones just off it.
    const onScreen =
      viewRef.current && visiblePart(page, viewRef.current.docRect) !== null;
    let task: RenderTask | null = null;
    let current = true;
    const cancelQueued = queuePageDrawing(onScreen ? 0 : 1, (done) => {
      const canvas = document.createElement("canvas");
      canvas.width = target.width;
      canvas.height = target.height;
      canvas.className = "viewer-base";
      const diag = startRender(
        scale,
        wanted,
        limit,
        canvas.width * canvas.height,
        "base",
      );
      stat.base = diag;
      const t = proxy.render({
        canvas,
        viewport: proxy.getViewport({ scale }),
      });
      task = t;
      t.promise.then(
        () => {
          endRender(diag, "done");
          done();
          if (!current) return releaseCanvas(canvas);
          showBase(canvas, scale, proxy);
          // Next time it shows at once (savedPages.ts).
          savePageSoon(canvas, page.drawingId, page.source);
        },
        (error: unknown) => {
          done();
          releaseCanvas(canvas);
          if (isCancel(error)) return endRender(diag, "cancelled");
          endRender(diag, "failed");
          recordError(`Page ${page.number} render failed`, error);
          console.error("Page render failed", error);
        },
      );
      return () => t.cancel();
    });
    // A pinch pauses drawing too; the next settled view starts it again.
    const unregister = registerRender(() => cancelQueued());
    return () => {
      current = false;
      unregister();
      cancelQueued();
      task?.cancel();
    };
    // Re-render only when the page, its quality target or motion changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    proxy,
    fitQuality,
    moving,
    rendered,
    noSavedImage,
    page.key,
    page.source,
    page.scale,
    page.size.width,
    page.size.height,
    page.drawingId,
    page.number,
  ]);

  // A quick low-detail preview until the full base image is drawn, so a
  // page coming on screen mid-scroll isn't blank (step 10b); not needed
  // when it has a saved image.
  useEffect(() => {
    if (!proxy || !fitQuality || !noSavedImage || baseScale.current > 0) return;
    const { wanted, scale: full } = baseTarget(
      page.size,
      page.scale,
      fitQuality,
    );
    const scale = full * PREVIEW_FRACTION;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(page.size.width * scale));
    canvas.height = Math.max(1, Math.round(page.size.height * scale));
    canvas.className = "viewer-base viewer-preview";
    const diag = startRender(
      scale,
      wanted,
      "preview",
      canvas.width * canvas.height,
      "preview",
    );
    pageStat(
      page.key,
      page.drawingId,
      page.number,
      page.size.width,
      page.size.height,
    ).preview = diag;
    const task = proxy.render({
      canvas,
      viewport: proxy.getViewport({ scale }),
    });
    let current = true;
    task.promise.then(
      () => {
        endRender(diag, "done");
        // Not over a full image that arrived first.
        if (!current || baseScale.current > 0) return releaseCanvas(canvas);
        clearHost(baseHost.current);
        baseHost.current?.appendChild(canvas);
      },
      (error: unknown) => {
        releaseCanvas(canvas);
        if (isCancel(error)) return endRender(diag, "cancelled");
        endRender(diag, "failed");
        recordError(`Page ${page.number} preview failed`, error);
      },
    );
    return () => {
      current = false;
      task.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    proxy,
    fitQuality,
    noSavedImage,
    page.key,
    page.scale,
    page.size.width,
    page.size.height,
  ]);

  // Off screen: keep the full base image a while (pageImages.ts) and let
  // the rest go. Unmounting lets everything go.
  useEffect(() => {
    if (active) return;
    const base = baseHost.current?.querySelector<HTMLCanvasElement>(
      "canvas.viewer-base:not(.viewer-preview)",
    );
    if (base && baseScale.current > 0)
      keepPageImage(imageKey(page), base, baseScale.current);
    clearHost(baseHost.current);
    clearHost(tileHost.current);
    baseScale.current = 0;
    diagnostics.pages.delete(page.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, page.key]);
  useEffect(() => {
    const base = baseHost.current;
    const tile = tileHost.current;
    return () => {
      clearHost(base);
      clearHost(tile);
      diagnostics.pages.delete(page.key);
    };
  }, [page.key]);

  // Sharpen the visible part after each gesture settles.
  const tileTask = useRef<RenderTask | null>(null);
  useEffect(() => {
    tileTask.current?.cancel();
    if (!proxy || !view || !rendered) return;
    const part = visiblePart(page, view.docRect);
    const wanted = view.devicePxPerDocUnit * page.scale;
    let scale = wanted;
    if (!part || scale <= baseScale.current * 1.1) {
      clearHost(tileHost.current);
      pageStat(
        page.key,
        page.drawingId,
        page.number,
        page.size.width,
        page.size.height,
      ).sharp = null;
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
    const diag = startRender(
      scale,
      wanted,
      scale < wanted * 0.999 ? "budget" : null,
      canvas.width * canvas.height,
      "sharp",
    );
    pageStat(
      page.key,
      page.drawingId,
      page.number,
      page.size.width,
      page.size.height,
    ).sharp = diag;
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
        endRender(diag, "done");
        if (tileTask.current !== task) return releaseCanvas(canvas);
        clearHost(tileHost.current);
        tileHost.current?.appendChild(canvas);
        tileTask.current = null;
      },
      (error: unknown) => {
        unregister();
        releaseCanvas(canvas);
        if (isCancel(error)) return endRender(diag, "cancelled");
        endRender(diag, "failed");
        recordError(`Page ${page.number} sharp render failed`, error);
        console.error("Tile render failed", error);
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
