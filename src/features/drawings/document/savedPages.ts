/**
 * Saved page images (step 10b, engineer-agreed 2026-10-08): the first time
 * a page's base image is drawn it is saved losslessly (PNG), pixel for
 * pixel what the viewer drew, so next time (any session) it shows at once
 * instead of being drawn from the PDF again. While the document is still,
 * the pages not yet saved are drawn and saved in the background, one at a
 * time, nearest first. Zooming in still draws sharp detail from the PDF.
 */
import { useEffect, useRef } from "react";
import { db } from "../../../db/db";
import {
  loadPageImage,
  pageImageId,
  prunePageImages,
  savedPageImageIds,
  savePageImage,
} from "../../../db/pageImages";
import type { PDFDocumentProxy } from "../pdf/pdfjs";
import { beginActivity, endActivity, recordError } from "./diagnostics";
import type { DocumentLayout, PageLayout } from "./documentLayout";
import { baseTarget, queuePageDrawing } from "./pageImages";

/** Pages saved (or found saved) this session, by saved-image id. */
const known = new Set<string>();

function release(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/** The page's saved base image at this size, drawn into a canvas, or null. */
export async function loadSavedPage(
  drawingId: string,
  source: number,
  width: number,
  height: number,
): Promise<HTMLCanvasElement | null> {
  const id = pageImageId(drawingId, source, width, height);
  const image = await loadPageImage(db, id);
  if (!image) return null;
  known.add(id);
  // Decoded off the main thread.
  const bitmap = await createImageBitmap(
    new Blob([image.data], { type: "image/png" }),
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

function encodePng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * Saves a page's freshly drawn base image, in its turn after any drawing
 * (it never runs alongside one).
 */
export function savePageSoon(
  canvas: HTMLCanvasElement,
  drawingId: string,
  source: number,
) {
  const id = pageImageId(drawingId, source, canvas.width, canvas.height);
  if (known.has(id)) return;
  known.add(id);
  const { width, height } = canvas;
  queuePageDrawing(2, (done) => {
    // Let go since (kept images are let go when memory runs short).
    if (canvas.width !== width) {
      known.delete(id);
      done();
      return () => {};
    }
    beginActivity("saving");
    void encodePng(canvas)
      .then(async (blob) => {
        if (!blob) throw new Error("The page image couldn't be encoded");
        await savePageImage(db, {
          drawingId,
          source,
          width,
          height,
          data: await blob.arrayBuffer(),
        });
      })
      .catch((error: unknown) => {
        known.delete(id);
        recordError("Saving a page image failed", error);
      })
      .finally(() => {
        endActivity("saving");
        done();
      });
    return () => {};
  });
}

/** How long the document must be still before saving pages ahead. */
const IDLE_MS = 1500;

/**
 * While the document is still, draws and saves the pages not yet saved,
 * one at a time, nearest the current page first (only drawings whose PDF
 * is open). Pages on screen save themselves once drawn. Also tidies away
 * saved images of deleted drawings when the drawings open.
 */
export function useSavePagesAhead({
  layout,
  docs,
  fitQuality,
  moving,
  currentKey,
  activeKeys,
}: {
  layout: DocumentLayout;
  docs: Map<string, PDFDocumentProxy>;
  fitQuality: number;
  moving: boolean;
  currentKey: string | null;
  activeKeys: Set<string>;
}) {
  const activeRef = useRef(activeKeys);
  useEffect(() => {
    activeRef.current = activeKeys;
  });

  useEffect(() => {
    void prunePageImages(db).catch(() => {});
  }, []);

  const drawingIds = [...new Set(layout.pages.map((p) => p.drawingId))]
    .sort()
    .join(",");
  useEffect(() => {
    if (!drawingIds) return;
    void savedPageImageIds(db, drawingIds.split(",")).then((ids) => {
      for (const id of ids) known.add(id);
    });
  }, [drawingIds]);

  useEffect(() => {
    if (moving || !fitQuality) return;
    let stopped = false;
    let cancel: (() => void) | null = null;
    let timer = 0;

    const target = (page: PageLayout) =>
      baseTarget(page.size, page.scale, fitQuality);
    const idOf = (page: PageLayout) => {
      const t = target(page);
      return pageImageId(page.drawingId, page.source, t.width, t.height);
    };

    /** The nearest page not saved yet (off screen, its PDF open). */
    function nextPage(): PageLayout | null {
      const current =
        layout.pages.find((p) => p.key === currentKey)?.number ?? 1;
      const seen = new Set<string>();
      return (
        [...layout.pages]
          .sort(
            (a, b) =>
              Math.abs(a.number - current) - Math.abs(b.number - current) ||
              a.number - b.number,
          )
          .find((page) => {
            const id = idOf(page);
            // A duplicated page shows the same PDF page: saved once.
            if (seen.has(id)) return false;
            seen.add(id);
            return (
              !known.has(id) &&
              !activeRef.current.has(page.key) &&
              docs.has(page.drawingId)
            );
          }) ?? null
      );
    }

    function saveNext() {
      if (stopped) return;
      const page = nextPage();
      const doc = page && docs.get(page.drawingId);
      if (!page || !doc) return;
      const id = idOf(page);
      cancel = queuePageDrawing(2, (done) => {
        let canvas: HTMLCanvasElement | null = null;
        let task: { cancel: () => void } | null = null;
        let over = false;
        beginActivity("background");
        /** Ends this run; false if it had already ended. */
        const stop = () => {
          if (over) return false;
          over = true;
          endActivity("background");
          if (canvas) release(canvas);
          return true;
        };
        // Finished: on to the next page. (Paused or cancelled: the queue
        // runs this job again, or the effect has stopped.)
        const finish = () => {
          if (!stop()) return;
          done();
          if (!stopped) timer = window.setTimeout(saveNext, 100);
        };
        void (async () => {
          try {
            const proxy = await doc.getPage(page.source);
            if (over) return;
            const t = target(page);
            canvas = document.createElement("canvas");
            canvas.width = t.width;
            canvas.height = t.height;
            const render = proxy.render({
              canvas,
              viewport: proxy.getViewport({ scale: t.scale }),
            });
            task = render;
            await render.promise;
            if (over) return;
            beginActivity("saving");
            const blob = await encodePng(canvas).finally(() =>
              endActivity("saving"),
            );
            if (!blob) throw new Error("The page image couldn't be encoded");
            await savePageImage(db, {
              drawingId: page.drawingId,
              source: page.source,
              width: t.width,
              height: t.height,
              data: await blob.arrayBuffer(),
            });
            known.add(id);
            if (!activeRef.current.has(page.key)) proxy.cleanup();
          } catch (error) {
            if (
              !(error instanceof Error) ||
              error.name !== "RenderingCancelledException"
            ) {
              // Don't try this page again this session.
              known.add(id);
              recordError(`Saving page ${page.number} ahead failed`, error);
            }
          }
          finish();
        })();
        return () => {
          task?.cancel();
          stop();
        };
      });
    }

    timer = window.setTimeout(saveNext, IDLE_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      cancel?.();
    };
    // Starts again after each move (and when PDFs open or the layout changes).
  }, [moving, fitQuality, layout, docs, currentKey]);
}
