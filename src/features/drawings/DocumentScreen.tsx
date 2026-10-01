import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { db } from "../../db/db";
import { listDrawings, setPageSizes } from "../../db/drawings";
import { createItem, moveObservationBox, updateItem } from "../../db/items";
import type { Drawing } from "../../db/types";
import { ItemSheet } from "../items/ItemSheet";
import {
  DocumentViewer,
  type DocPin,
  type ScrollTarget,
} from "./document/DocumentViewer";
import {
  layoutDocument,
  pageKey,
  type PageLayout,
} from "./document/documentLayout";
import { usePdfDocuments } from "./document/usePdfDocuments";
import { ObservationBoxOverlay } from "./ObservationBoxOverlay";
import { boxHeader, boxLines, defaultBoxPosition } from "./observationBox";
import type { Point } from "./viewer/viewTransform";

const DEFAULT_HEADING = "Noted for information:";

/** Measures and saves page sizes for drawings added before they were stored. */
async function backfillPageSizes(drawing: Drawing) {
  const stored = await db.blobs.get(drawing.pdfBlobId);
  if (!stored) return;
  const { loadPdf } = await import("./pdf/pdfjs");
  const { measurePageSizes } = await import("./pdf/pageSizes");
  const pdf = await loadPdf(new Uint8Array(stored.data.slice(0)));
  try {
    await setPageSizes(db, drawing.id, await measurePageSizes(pdf));
  } finally {
    await pdf.loadingTask.destroy();
  }
}

export function DocumentScreen() {
  const { id = "" } = useParams();
  return <InspectionDocument key={id} inspectionId={id} />;
}

/**
 * All of an inspection's drawings as one scrolling document, with pins, the
 * item sheet and each page's notes box. URL: ?drawing=<id> opens at that
 * drawing, ?item=<id> selects an item and scrolls to its pin.
 */
function InspectionDocument({ inspectionId }: { inspectionId: string }) {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("item");
  const startDrawing = params.get("drawing");

  const inspection = useLiveQuery(
    () => db.inspections.get(inspectionId),
    [inspectionId],
  );
  const drawings = useLiveQuery(
    () => listDrawings(db, inspectionId),
    [inspectionId],
  );
  const items = useLiveQuery(
    () => db.items.where("inspectionId").equals(inspectionId).toArray(),
    [inspectionId],
  );
  const boxes = useLiveQuery(async () => {
    const ids = (await db.drawings
      .where("inspectionId")
      .equals(inspectionId)
      .primaryKeys()) as string[];
    return db.observationBoxes
      .filter((b) => ids.includes(b.drawingId))
      .toArray();
  }, [inspectionId]);
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

  const [addPinMode, setAddPinMode] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);
  const [justPlaced, setJustPlaced] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Record<string, Point>>({});
  const [current, setCurrent] = useState<PageLayout | null>(null);
  const [needed, setNeeded] = useState<string[]>([]);
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  // Drawings added before page sizes were stored get them measured once.
  const missingSizes =
    drawings
      ?.filter((d) => !d.pageSizes)
      .map((d) => d.id)
      .join(",") ?? "";
  useEffect(() => {
    if (!missingSizes || !drawings) return;
    let current = true;
    void (async () => {
      for (const drawing of drawings.filter((d) => !d.pageSizes)) {
        if (!current) return;
        try {
          await backfillPageSizes(drawing);
        } catch (e) {
          setBackfillError(
            `${drawing.name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    })();
    return () => {
      current = false;
    };
    // Re-run only when the set of drawings without sizes changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingSizes]);

  const layout = useMemo(
    () =>
      layoutDocument(
        (drawings ?? [])
          .filter((d) => d.pageSizes)
          .map((d) => ({ id: d.id, name: d.name, pageSizes: d.pageSizes! })),
      ),
    [drawings],
  );

  const blobIds = useMemo(
    () => new Map((drawings ?? []).map((d) => [d.id, d.pdfBlobId])),
    [drawings],
  );
  const { docs, errors } = usePdfDocuments(needed, blobIds);

  const selected = items?.find((item) => item.id === selectedId) ?? null;

  // Initial scroll: to the selected item, else the requested drawing.
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (initialScrollDone.current || layout.pages.length === 0 || !items)
      return;
    initialScrollDone.current = true;
    // One-off, once the drawings and items have loaded (not a render loop).
    if (selected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScrollTarget({
        pageKey: pageKey(selected.drawingId, selected.page),
        at: { x: selected.x, y: selected.y },
        token: Date.now(),
      });
    } else if (startDrawing) {
      setScrollTarget({ pageKey: pageKey(startDrawing, 1), token: Date.now() });
    }
  }, [layout, items, selected, startDrawing]);

  const pins: DocPin[] = (items ?? []).map((item) => ({
    id: item.id,
    letter: item.letter,
    kind: item.kind,
    selected: item.id === selectedId,
    pageKey: pageKey(item.drawingId, item.page),
    ...(dragging[item.id] ?? { x: item.x, y: item.y }),
  }));

  function select(itemId: string | null) {
    const next: Record<string, string> = {};
    if (itemId) next.item = itemId;
    setParams(next, { replace: true });
  }

  async function placePin(page: PageLayout, at: Point) {
    setAddPinMode(false);
    const item = await createItem(
      db,
      { inspectionId, drawingId: page.drawingId, page: page.page, ...at },
      defaultBoxPosition(page.size),
    );
    setJustPlaced(item.id);
    select(item.id);
  }

  function renderPageOverlay(page: PageLayout) {
    const box = boxes?.find(
      (b) => b.drawingId === page.drawingId && b.page === page.page,
    );
    if (!box || !inspection) return null;
    const pageItems = (items ?? []).filter(
      (item) => item.drawingId === page.drawingId && item.page === page.page,
    );
    return (
      <ObservationBoxOverlay
        box={box}
        lines={boxLines({
          header: boxHeader(inspection),
          observationHeading: heading ?? DEFAULT_HEADING,
          items: pageItems,
        })}
        onMoveEnd={(to) =>
          void moveObservationBox(db, box.id, to, inspectionId)
        }
      />
    );
  }

  if (inspection === undefined || drawings === undefined) return null;
  if (!inspection) {
    return (
      <section>
        <p>
          <Link to="/">‹ Inspections</Link>
        </p>
        <h1>Inspection not found</h1>
      </section>
    );
  }

  const currentDrawing = drawings.find((d) => d.id === current?.drawingId);
  const loadError = [...errors.values()][0] ?? backfillError;

  return (
    <section className="drawing-screen">
      <div className="viewer-toolbar" role="toolbar" aria-label="Drawings">
        <Link to={`/inspections/${inspectionId}`}>‹ Inspection</Link>
        <strong className="drawing-name" data-testid="page-indicator">
          {currentDrawing && current
            ? `${currentDrawing.name} · page ${current.page} of ${current.pageCount}`
            : ""}
        </strong>
        <button type="button" onClick={() => setFitRequest((n) => n + 1)}>
          Fit page
        </button>
        <button
          type="button"
          aria-pressed={addPinMode}
          className={addPinMode ? "toggle-on" : "primary"}
          onClick={() => setAddPinMode((on) => !on)}
          disabled={layout.pages.length === 0}
        >
          {addPinMode ? "Tap the drawing…" : "Add pin"}
        </button>
      </div>

      {loadError && (
        <p role="alert" className="error">
          Could not open a drawing: {loadError}
        </p>
      )}

      <div className={`drawing-body${selected ? " with-sheet" : ""}`}>
        {drawings.length === 0 ? (
          <p className="muted">
            No drawings yet. Add them from the{" "}
            <Link to={`/inspections/${inspectionId}`}>inspection</Link>.
          </p>
        ) : (
          <DocumentViewer
            layout={layout}
            docs={docs}
            pins={pins}
            addPinMode={addPinMode}
            onPlacePin={(page, at) => void placePin(page, at)}
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
            onCurrentPage={setCurrent}
            onActiveDrawings={setNeeded}
            renderPageOverlay={renderPageOverlay}
            scrollTarget={scrollTarget}
            fitRequest={fitRequest}
          />
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
