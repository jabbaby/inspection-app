// Spike B: tries the drawing viewer on the iPad. Pins live in memory only and
// are lost on reload (saving items properly is build step 5). Temporary.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { letterForIndex } from "../../items/letters";
import type { PDFDocumentProxy, PDFPageProxy } from "../pdf/pdfjs";
import { DrawingViewer, type ViewerStats } from "../viewer/DrawingViewer";
import type { Point } from "../viewer/viewTransform";

interface SpikePin {
  id: string;
  letter: string;
  page: number;
  x: number;
  y: number;
}

type Source = "typical" | "heavy" | "file";

const PAPER: [string, number, number][] = [
  ["A0", 2383.94, 3370.39],
  ["A1", 1683.78, 2383.94],
  ["A2", 1190.55, 1683.78],
  ["A3", 841.89, 1190.55],
  ["A4", 595.28, 841.89],
];

function paperName(w: number, h: number): string {
  const [short, long] = w < h ? [w, h] : [h, w];
  return (
    PAPER.find(
      ([, s, l]) => Math.abs(s - short) < 3 && Math.abs(l - long) < 3,
    )?.[0] ?? "custom"
  );
}

const mp = (pixels: number) => `${(pixels / 1e6).toFixed(1)} MP`;

/** A noisy photo-like JPEG to make a raster-heavy sheet. */
async function makeRasterJpeg(): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = 3000;
  canvas.height = 2100;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(canvas.width, canvas.height);
  let seed = 7;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const px = (i / 4) % canvas.width;
    const noise = seed >>> 25;
    image.data[i] = 120 + (px % 255) / 3 + noise / 2;
    image.data[i + 1] = 130 + noise;
    image.data[i + 2] = 110 + noise / 3;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.font = "bold 90px sans-serif";
  ctx.fillText("SYNTHETIC RASTER UNDERLAY", 200, 1100);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG failed"))),
      "image/jpeg",
      0.85,
    ),
  );
  canvas.width = 0;
  return new Uint8Array(await blob.arrayBuffer());
}

async function buildFixture(source: "typical" | "heavy"): Promise<Uint8Array> {
  const { buildSyntheticDrawing, TYPICAL_DRAWING, HEAVY_DRAWING } =
    await import("../fixtures/syntheticDrawing");
  if (source === "typical") return buildSyntheticDrawing(TYPICAL_DRAWING);
  return buildSyntheticDrawing([
    ...HEAVY_DRAWING,
    {
      size: "A1",
      number: "S-103",
      title: "RASTER UNDERLAY (SYNTHETIC)",
      rasterJpeg: await makeRasterJpeg(),
    },
  ]);
}

export function ViewerSpikePage() {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [docInfo, setDocInfo] = useState<{
    name: string;
    bytes: number;
    loadMs: number;
  } | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [pins, setPins] = useState<SpikePin[]>([]);
  const nextIndex = useRef(0);
  const [addPinMode, setAddPinMode] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);
  const [stats, setStats] = useState<ViewerStats | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function open(source: Source, file?: File) {
    setBusy(source === "file" ? "Opening PDF…" : "Generating drawing…");
    setError(null);
    try {
      const started = performance.now();
      const bytes = file
        ? new Uint8Array(await file.arrayBuffer())
        : await buildFixture(source as "typical" | "heavy");
      const { loadPdf } = await import("../pdf/pdfjs");
      const size = bytes.length;
      const next = await loadPdf(bytes);
      // The old document is destroyed by the effect below.
      setPage(null);
      setDoc(next);
      setDocInfo({
        name: file?.name ?? `synthetic-${source}.pdf`,
        bytes: size,
        loadMs: Math.round(performance.now() - started),
      });
      setPageNumber(1);
      setPins([]);
      nextIndex.current = 0;
      setAddPinMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!doc) return;
    let current = true;
    void doc.getPage(pageNumber).then((p) => {
      if (current) setPage(p);
    });
    return () => {
      current = false;
    };
  }, [doc, pageNumber]);

  useEffect(() => () => void doc?.loadingTask.destroy(), [doc]);

  function placePin(at: Point) {
    const letter = letterForIndex(nextIndex.current++);
    setPins((list) => [
      ...list,
      { id: crypto.randomUUID(), letter, page: pageNumber, ...at },
    ]);
    setAddPinMode(false);
  }

  function movePin(id: string, to: Point) {
    setPins((list) => list.map((p) => (p.id === id ? { ...p, ...to } : p)));
  }

  const pagePins = pins.filter((p) => p.page === pageNumber);
  const lastPin = pins[pins.length - 1];

  return (
    <section className="viewer-spike">
      <div
        className="viewer-toolbar"
        role="toolbar"
        aria-label="Drawing viewer"
      >
        <Link to="/settings">‹ Settings</Link>
        <button
          type="button"
          onClick={() => void open("typical")}
          disabled={!!busy}
        >
          Typical drawing
        </button>
        <button
          type="button"
          onClick={() => void open("heavy")}
          disabled={!!busy}
        >
          Heavy drawing
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={!!busy}
        >
          Open PDF…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void open("file", file);
          }}
        />
        {doc && (
          <>
            <span className="toolbar-group">
              <button
                type="button"
                aria-label="Previous page"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((n) => n - 1)}
              >
                ‹
              </button>
              <span data-testid="page-indicator">
                {pageNumber} / {doc.numPages}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={pageNumber >= doc.numPages}
                onClick={() => setPageNumber((n) => n + 1)}
              >
                ›
              </button>
            </span>
            <button type="button" onClick={() => setFitRequest((n) => n + 1)}>
              Fit
            </button>
            <button
              type="button"
              aria-pressed={addPinMode}
              className={addPinMode ? "toggle-on" : undefined}
              onClick={() => setAddPinMode((on) => !on)}
            >
              {addPinMode ? "Tap the drawing…" : "Add pin"}
            </button>
            <button
              type="button"
              disabled={pins.length === 0}
              onClick={() => setPins([])}
            >
              Clear pins
            </button>
          </>
        )}
      </div>

      <p className="viewer-hud" data-testid="viewer-hud">
        {busy ??
          error ??
          (docInfo && stats
            ? [
                `${docInfo.name} ${Math.round(docInfo.bytes / 1024)} KB, opened in ${docInfo.loadMs} ms`,
                `sheet ${paperName(stats.pageWidth, stats.pageHeight)}`,
                `first render ${stats.baseMs} ms (${mp(stats.basePixels)})`,
                stats.tileMs !== undefined && stats.tilePixels !== undefined
                  ? `sharp render ${stats.tileMs} ms (${mp(stats.tilePixels)})`
                  : "sharp render not needed",
                `zoom ${Math.round(stats.zoom * 100)}%`,
                lastPin
                  ? `last pin ${lastPin.letter} (${lastPin.x.toFixed(4)}, ${lastPin.y.toFixed(4)})`
                  : "no pins",
              ].join(" · ")
            : "Open a drawing to start. Pins are not saved in this spike.")}
      </p>

      {page ? (
        <DrawingViewer
          page={page}
          pins={pagePins}
          addPinMode={addPinMode}
          onPlacePin={placePin}
          onMovePin={movePin}
          onStats={setStats}
          fitRequest={fitRequest}
        />
      ) : (
        <div className="viewer viewer-empty" />
      )}
    </section>
  );
}
