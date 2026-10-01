import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { db } from "../../db/db";
import { createItem, moveObservationBox, updateItem } from "../../db/items";
import type { Item } from "../../db/types";
import { ItemSheet } from "../items/ItemSheet";
import { indexForLetter } from "../items/letters";
import { ObservationBoxOverlay } from "./ObservationBoxOverlay";
import {
  boxHeader,
  defaultBoxPosition,
  observationLines,
} from "./observationBox";
import type { PDFDocumentProxy, PDFPageProxy } from "./pdf/pdfjs";
import { DrawingViewer, type ViewerPin } from "./viewer/DrawingViewer";
import type { Point } from "./viewer/viewTransform";

const DEFAULT_HEADING = "Noted for information:";

export function DrawingPage() {
  const { id = "", drawingId = "" } = useParams();
  return (
    <DrawingScreen key={drawingId} inspectionId={id} drawingId={drawingId} />
  );
}

function DrawingScreen({
  inspectionId,
  drawingId,
}: {
  inspectionId: string;
  drawingId: string;
}) {
  const [params, setParams] = useSearchParams();
  const pageNumber = Math.max(1, Number(params.get("page")) || 1);
  const selectedId = params.get("item");

  const inspection = useLiveQuery(
    () => db.inspections.get(inspectionId),
    [inspectionId],
  );
  const drawing = useLiveQuery(() => db.drawings.get(drawingId), [drawingId]);
  const items = useLiveQuery(
    () => db.items.where("drawingId").equals(drawingId).toArray(),
    [drawingId],
  );
  const boxes = useLiveQuery(
    () =>
      db.observationBoxes.filter((b) => b.drawingId === drawingId).toArray(),
    [drawingId],
  );
  const heading = useLiveQuery(async () => {
    const headings = await db.snippets
      .where("kind")
      .equals("heading")
      .toArray();
    return (
      headings.find((s) => s.id === "heading-noted-for-information")?.text ??
      headings[0]?.text ??
      DEFAULT_HEADING
    );
  }, []);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addPinMode, setAddPinMode] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);
  const [justPlaced, setJustPlaced] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Record<string, Point>>({});

  const pdfBlobId = drawing?.pdfBlobId;
  useEffect(() => {
    if (!pdfBlobId) return;
    let current = true;
    let loaded: PDFDocumentProxy | null = null;
    void (async () => {
      try {
        const stored = await db.blobs.get(pdfBlobId);
        if (!stored)
          throw new Error("The drawing's PDF is missing from this device.");
        const { loadPdf } = await import("./pdf/pdfjs");
        // pdf.js takes ownership of the buffer it is given, so pass a copy.
        loaded = await loadPdf(new Uint8Array(stored.data.slice(0)));
        if (current) setDoc(loaded);
        else void loaded.loadingTask.destroy();
      } catch (e) {
        if (current) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      current = false;
      void loaded?.loadingTask.destroy();
    };
  }, [pdfBlobId]);

  useEffect(() => {
    if (!doc) return;
    let current = true;
    void doc.getPage(Math.min(pageNumber, doc.numPages)).then((p) => {
      if (current) setPage(p);
    });
    return () => {
      current = false;
    };
  }, [doc, pageNumber]);

  const selected = items?.find((item) => item.id === selectedId) ?? null;

  // Opening a link to an item on another page jumps to that page.
  useEffect(() => {
    if (selected && selected.page !== pageNumber) {
      setParams(
        { page: String(selected.page), item: selected.id },
        { replace: true },
      );
    }
  }, [selected, pageNumber, setParams]);

  const pageSize = useMemo(() => {
    if (!page) return null;
    const vp = page.getViewport({ scale: 1 });
    return { width: vp.width, height: vp.height };
  }, [page]);

  const pageItems: Item[] = useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.page === pageNumber)
        .sort((a, b) => indexForLetter(a.letter) - indexForLetter(b.letter)),
    [items, pageNumber],
  );

  const pins: ViewerPin[] = pageItems.map((item) => ({
    id: item.id,
    letter: item.letter,
    kind: item.kind,
    selected: item.id === selectedId,
    ...(dragging[item.id] ?? { x: item.x, y: item.y }),
  }));

  const box = boxes?.find((b) => b.page === pageNumber);

  function select(itemId: string | null) {
    const next: Record<string, string> = { page: String(pageNumber) };
    if (itemId) next.item = itemId;
    setParams(next, { replace: true });
  }

  function goToPage(n: number) {
    setAddPinMode(false);
    setParams({ page: String(n) }, { replace: true });
  }

  async function placePin(at: Point) {
    if (!pageSize) return;
    setAddPinMode(false);
    const item = await createItem(
      db,
      { inspectionId, drawingId, page: pageNumber, ...at },
      defaultBoxPosition(pageSize),
    );
    setJustPlaced(item.id);
    select(item.id);
  }

  if (drawing === undefined || inspection === undefined) return null;
  if (!drawing || !inspection) {
    return (
      <section>
        <p>
          <Link to={`/inspections/${inspectionId}`}>‹ Inspection</Link>
        </p>
        <h1>Drawing not found</h1>
      </section>
    );
  }

  return (
    <section className="drawing-screen">
      <div className="viewer-toolbar" role="toolbar" aria-label="Drawing">
        <Link to={`/inspections/${inspectionId}`}>‹ Inspection</Link>
        <strong className="drawing-name">{drawing.name}</strong>
        {drawing.pageCount > 1 && (
          <span className="toolbar-group">
            <button
              type="button"
              aria-label="Previous page"
              disabled={pageNumber <= 1}
              onClick={() => goToPage(pageNumber - 1)}
            >
              ‹
            </button>
            <span data-testid="page-indicator">
              {pageNumber} / {drawing.pageCount}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={pageNumber >= drawing.pageCount}
              onClick={() => goToPage(pageNumber + 1)}
            >
              ›
            </button>
          </span>
        )}
        <button type="button" onClick={() => setFitRequest((n) => n + 1)}>
          Fit
        </button>
        <button
          type="button"
          aria-pressed={addPinMode}
          className={addPinMode ? "toggle-on" : "primary"}
          onClick={() => setAddPinMode((on) => !on)}
        >
          {addPinMode ? "Tap the drawing…" : "Add pin"}
        </button>
      </div>

      <div className={`drawing-body${selected ? " with-sheet" : ""}`}>
        {error ? (
          <p role="alert" className="error">
            Could not open the drawing: {error}
          </p>
        ) : page ? (
          <DrawingViewer
            page={page}
            pins={pins}
            addPinMode={addPinMode}
            onPlacePin={(at) => void placePin(at)}
            onMovePin={(itemId, to) =>
              setDragging((d) => ({ ...d, [itemId]: to }))
            }
            onMovePinEnd={(itemId, to) => {
              void updateItem(db, itemId, to).then(() =>
                setDragging((d) => {
                  const rest = { ...d };
                  delete rest[itemId];
                  return rest;
                }),
              );
            }}
            onSelectPin={(itemId) => select(itemId)}
            fitRequest={fitRequest}
            overlay={
              box && (
                <ObservationBoxOverlay
                  box={box}
                  header={boxHeader(inspection)}
                  heading={heading ?? DEFAULT_HEADING}
                  lines={observationLines(pageItems)}
                  onMoveEnd={(to) =>
                    void moveObservationBox(db, box.id, to, inspectionId)
                  }
                />
              )
            }
          />
        ) : (
          <div className="viewer viewer-empty" aria-busy="true" />
        )}

        {selected && (
          <ItemSheet
            key={selected.id}
            item={selected}
            autoFocus={selected.id === justPlaced}
            onClose={() => {
              setJustPlaced(null);
              select(null);
            }}
          />
        )}
      </div>
    </section>
  );
}
