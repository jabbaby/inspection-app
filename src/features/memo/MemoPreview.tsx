import { useEffect, useRef, useState } from "react";
import type { MemoAssets, MemoPdfInput } from "./pdf/renderMemoPdf";

/** Fonts and images, loaded once per app session. */
let assets: Promise<MemoAssets> | null = null;

/**
 * The memo as it will be exported: the real PDF, rebuilt shortly after each
 * change and drawn page by page. pdf-lib and pdf.js load on demand so they
 * stay out of the start-up bundle.
 */
export function MemoPreview({ input }: { input: MemoPdfInput }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"rendering" | "ready" | "error">(
    "rendering",
  );
  const [pages, setPages] = useState(0);
  const key = JSON.stringify(input);

  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(async () => {
      try {
        const [{ renderMemoPdf }, { loadMemoAssets }, { loadPdf }] =
          await Promise.all([
            import("./pdf/renderMemoPdf"),
            import("./pdf/loadMemoAssets"),
            import("../drawings/pdf/pdfjs"),
          ]);
        assets ??= loadMemoAssets();
        const bytes = await renderMemoPdf(input, await assets);
        if (!current) return;
        const pdf = await loadPdf(bytes);
        try {
          const width = host.current?.clientWidth || 600;
          const dpr = window.devicePixelRatio || 1;
          const canvases: HTMLCanvasElement[] = [];
          for (let n = 1; n <= pdf.numPages; n++) {
            const page = await pdf.getPage(n);
            const scale = (width / page.getViewport({ scale: 1 }).width) * dpr;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            canvas.className = "memo-preview-page";
            await page.render({ canvas, viewport }).promise;
            canvases.push(canvas);
          }
          if (!current || !host.current) return;
          for (const old of host.current.querySelectorAll("canvas")) {
            old.width = 0;
            old.height = 0;
          }
          host.current.replaceChildren(...canvases);
          setPages(canvases.length);
          setState("ready");
        } finally {
          await pdf.loadingTask.destroy();
        }
      } catch (e) {
        console.error("Memo preview failed", e);
        if (current) setState("error");
      }
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
    // Rebuild only when what the memo shows changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      className="memo-preview"
      aria-label="Memo preview"
      data-testid="memo-preview"
      data-ready={state === "ready"}
      data-pages={pages}
    >
      {state === "error" && (
        <p role="alert" className="error">
          The preview couldn&rsquo;t be drawn. Your changes are still saved.
        </p>
      )}
      <div ref={host} className="memo-preview-pages" />
    </div>
  );
}
