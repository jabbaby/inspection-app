import { ChevronLeft, Minus, Plus, Share } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { paperLabel } from "./paperLabel";

interface Props {
  title: string;
  /** The PDF's bytes (a bundled document, or an exported pack). */
  load: () => Promise<ArrayBuffer>;
  onClose: () => void;
  /**
   * Share… in the bar (engineer, 2026-10-07): gets the loaded bytes, so the
   * iPad's Share sheet opens straight from the tap.
   */
  onShare?: (bytes: ArrayBuffer) => void;
}

/** The widest page is drawn this many device px across (sharp when zoomed a little). */
const MAX_PAGE_PX = 2400;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

interface PageInfo {
  url: string;
  /** Its width as a share of the widest page's (1 for the widest). */
  share: number;
  label: string;
}

/**
 * A PDF shown inside the app, full screen, with a Back button (engineer,
 * 2026-10-07): an iPad home-screen app has no browser controls, so a PDF
 * opened as a page left no way back. Pages keep their sizes relative to
 * each other (an A4 memo beside an A1 drawing is a quarter as wide, as in a
 * PDF reader), each labelled with its paper size; pinch or the − and +
 * buttons zoom. Pages are drawn with pdf.js one at a time into images (the
 * canvases are freed straight away).
 */
export function PdfViewer({ title, load, onClose, onShare }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  // The PDF as loaded, for Share.
  const loaded = useRef<ArrayBuffer | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  // The zoom as last set, for a pinch to start from.
  const zoomRef = useRef(MIN_ZOOM);
  function applyZoom(z: number) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    zoomRef.current = next;
    setZoom(next);
  }

  useEffect(() => {
    let current = true;
    const urls: string[] = [];
    void (async () => {
      try {
        const [{ loadPdf }, bytes] = await Promise.all([
          import("../features/drawings/pdf/pdfjs"),
          load(),
        ]);
        loaded.current = bytes;
        if (current) setCanShare(true);
        // pdf.js may take over the buffer it is given: it gets a copy.
        const pdf = await loadPdf(new Uint8Array(bytes.slice(0)));
        try {
          // The widest page sets the scale for all of them.
          const sizes: { width: number; height: number }[] = [];
          for (let n = 1; n <= pdf.numPages; n++) {
            const v = (await pdf.getPage(n)).getViewport({ scale: 1 });
            sizes.push({ width: v.width, height: v.height });
          }
          const widest = Math.max(...sizes.map((s) => s.width));
          const pxPerPt =
            Math.min(
              (scroller.current?.clientWidth || 800) *
                (window.devicePixelRatio || 1) *
                2,
              MAX_PAGE_PX,
            ) / widest;
          for (let n = 1; n <= pdf.numPages && current; n++) {
            const page = await pdf.getPage(n);
            const viewport = page.getViewport({ scale: pxPerPt });
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            await page.render({ canvas, viewport }).promise;
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, "image/jpeg", 0.88),
            );
            canvas.width = 0;
            canvas.height = 0;
            if (!blob || !current) break;
            const url = URL.createObjectURL(blob);
            urls.push(url);
            const { width, height } = sizes[n - 1];
            setPages((list) => [
              ...list,
              {
                url,
                share: width / widest,
                label: `Page ${n} · ${paperLabel(width, height)}`,
              },
            ]);
            setState("ready");
          }
        } finally {
          await pdf.loadingTask.destroy();
        }
      } catch (e) {
        console.error("PDF viewer failed", e);
        if (current) setState("error");
      }
    })();
    return () => {
      current = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
    // Loads once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The keyboard's Escape goes back too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Two fingers zoom the pages (not the whole app).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let start: { dist: number; zoom: number } | null = null;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        start = { dist: dist(e.touches), zoom: zoomRef.current };
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return;
      e.preventDefault();
      applyZoom((start.zoom * dist(e.touches)) / start.dist);
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) start = null;
    };
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("gesturestart", stop);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("gesturestart", stop);
    };
  }, []);
  const step = (by: number) => applyZoom(zoomRef.current * by);

  return (
    <div
      className="pdf-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="pdf-viewer"
      data-pages={pages.length}
    >
      <div className="pdf-viewer-bar">
        <button type="button" className="pdf-viewer-back" onClick={onClose}>
          <ChevronLeft aria-hidden="true" /> Back
        </button>
        <h2>{title}</h2>
        <div className="pdf-viewer-zoom">
          <button
            type="button"
            className="icon-button quiet"
            aria-label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => step(1 / 1.5)}
          >
            <Minus aria-hidden="true" />
          </button>
          <span className="muted small">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="icon-button quiet"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => step(1.5)}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
        {onShare && (
          <button
            type="button"
            className="emphasis"
            disabled={!canShare}
            onClick={() => loaded.current && onShare(loaded.current)}
          >
            <Share aria-hidden="true" /> Share…
          </button>
        )}
      </div>
      <div ref={scroller} className="pdf-viewer-scroll">
        {state === "loading" && <p className="muted">Opening…</p>}
        {state === "error" && (
          <p role="alert" className="error">
            The PDF couldn&rsquo;t be shown.
          </p>
        )}
        <div className="pdf-viewer-pages" style={{ width: `${zoom * 100}%` }}>
          {pages.map((p, i) => (
            <figure
              key={p.url}
              className="pdf-viewer-figure"
              style={{ width: `${p.share * 100}%` }}
            >
              <img
                className="pdf-viewer-page"
                src={p.url}
                alt={`Page ${i + 1}`}
              />
              <figcaption className="muted small">{p.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
