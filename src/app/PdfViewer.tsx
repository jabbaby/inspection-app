import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  /** The PDF's bytes (a bundled document, or an exported pack). */
  load: () => Promise<ArrayBuffer>;
  onClose: () => void;
}

/** The widest a page is drawn (device px): sharp on an iPad, light on memory. */
const MAX_PAGE_PX = 1600;

/**
 * A PDF shown inside the app, full screen, with a Back button (engineer,
 * 2026-10-07): an iPad home-screen app has no browser controls, so a PDF
 * opened as a page left no way back. Pages are drawn with pdf.js one at a
 * time into images (the canvases are freed straight away).
 */
export function PdfViewer({ title, load, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let current = true;
    const urls: string[] = [];
    void (async () => {
      try {
        const [{ loadPdf }, bytes] = await Promise.all([
          import("../features/drawings/pdf/pdfjs"),
          load(),
        ]);
        const pdf = await loadPdf(new Uint8Array(bytes));
        try {
          const width = Math.min(
            (host.current?.clientWidth || 800) * (window.devicePixelRatio || 1),
            MAX_PAGE_PX,
          );
          for (let n = 1; n <= pdf.numPages && current; n++) {
            const page = await pdf.getPage(n);
            const viewport = page.getViewport({
              scale: width / page.getViewport({ scale: 1 }).width,
            });
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            await page.render({ canvas, viewport }).promise;
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve, "image/jpeg", 0.88),
            );
            canvas.width = 0;
            canvas.height = 0;
            if (!blob || !current || !host.current) break;
            const url = URL.createObjectURL(blob);
            urls.push(url);
            const img = document.createElement("img");
            img.className = "pdf-viewer-page";
            img.alt = `Page ${n}`;
            img.src = url;
            host.current.append(img);
            setPages(n);
            if (n === 1) setState("ready");
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

  return (
    <div
      className="pdf-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="pdf-viewer"
      data-pages={pages}
    >
      <div className="pdf-viewer-bar">
        <button type="button" className="pdf-viewer-back" onClick={onClose}>
          <ChevronLeft aria-hidden="true" /> Back
        </button>
        <h2>{title}</h2>
      </div>
      <div className="pdf-viewer-scroll">
        {state === "loading" && <p className="muted">Opening…</p>}
        {state === "error" && (
          <p role="alert" className="error">
            The PDF couldn&rsquo;t be shown.
          </p>
        )}
        <div ref={host} className="pdf-viewer-pages" />
      </div>
    </div>
  );
}
