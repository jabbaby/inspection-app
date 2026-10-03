import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronDown,
  Files,
  List,
  MapPinPlus,
  Maximize,
  Redo2,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { NotFound } from "../../app/NotFound";
import { redoLast, undoLast, useUndo } from "../../app/undo";
import { db } from "../../db/db";
import { listDrawings, setPageSizes } from "../../db/drawings";
import { moveObservationBox, updateItem } from "../../db/items";
import { createItemWithUndo, setArrowsWithUndo } from "../items/itemActions";
import { InspectionHeader } from "../inspections/InspectionTabs";
import { QuickPhotoButton } from "../photos/QuickPhotoButton";
import { DrawingsSection } from "./DrawingsSection";
import { kindName } from "../items/letters";
import { ArrowsOverlay } from "./ArrowsOverlay";
import type { Drawing, Item } from "../../db/types";
import { ItemSheet } from "../items/ItemSheet";
import { ItemsPanel } from "../items/ItemsPanel";
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

  const history = useUndo(inspectionId);
  const [addPinMode, setAddPinMode] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [drawingsOpen, setDrawingsOpen] = useState(false);
  // While drawings are being added (or one failed), the list stays in view
  // so its progress and errors can be read.
  const [adding, setAdding] = useState({ busy: false, failed: false });
  const [fitRequest, setFitRequest] = useState(0);
  const [justPlaced, setJustPlaced] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Record<string, Point>>({});
  const [current, setCurrent] = useState<PageLayout | null>(null);
  const [needed, setNeeded] = useState<string[]>([]);
  const [pinsInView, setPinsInView] = useState<Set<string>>(() => new Set());
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  // Arrows: the item waiting for a tap, the selected tip, a tip being dragged.
  const [placingArrow, setPlacingArrow] = useState<string | null>(null);
  const [arrowMessage, setArrowMessage] = useState<string | null>(null);
  const [selectedArrow, setSelectedArrow] = useState<string | null>(null);
  const [draggingArrow, setDraggingArrow] = useState<{
    itemId: string;
    arrowId: string;
    to: Point;
  } | null>(null);

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

  /** An item as shown right now: a pin or arrow tip mid-drag included. */
  function live(item: Item) {
    const arrows = (item.arrows ?? []).map((arrow) =>
      draggingArrow?.itemId === item.id && draggingArrow.arrowId === arrow.id
        ? { ...arrow, ...draggingArrow.to }
        : arrow,
    );
    return { ...item, ...(dragging[item.id] ?? {}), arrows };
  }

  const pins: DocPin[] = (items ?? []).map((item) => {
    const shown = live(item);
    return {
      id: item.id,
      letter: item.letter,
      kind: item.kind,
      selected: item.id === selectedId,
      pageKey: pageKey(item.drawingId, item.page),
      x: shown.x,
      y: shown.y,
      arrows: shown.arrows,
      selectedArrowId: item.id === selectedId ? selectedArrow : null,
    };
  });

  function select(itemId: string | null) {
    const next: Record<string, string> = {};
    if (itemId) next.item = itemId;
    setParams(next, { replace: true });
    if (itemId !== selectedId) {
      setSelectedArrow(null);
      setPlacingArrow(null);
      setArrowMessage(null);
    }
  }

  async function placeArrow(page: PageLayout, at: Point) {
    const item = items?.find((i) => i.id === placingArrow);
    if (!item) return setPlacingArrow(null);
    if (page.drawingId !== item.drawingId || page.page !== item.page) {
      // Arrows stay on the pin's page; keep waiting for a tap there.
      setArrowMessage(
        `Tap on page ${item.page} of this drawing, where the pin is.`,
      );
      return;
    }
    const arrow = { id: crypto.randomUUID(), ...at };
    setPlacingArrow(null);
    setArrowMessage(null);
    await setArrowsWithUndo(
      item,
      [...(item.arrows ?? []), arrow],
      `Add arrow to ${kindName(item.kind).toLowerCase()} ${item.letter}`,
    );
    setSelectedArrow(arrow.id);
  }

  async function placePin(page: PageLayout, at: Point) {
    setAddPinMode(false);
    const item = await createItemWithUndo(
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
    if (!inspection) return null;
    const pageItems = (items ?? []).filter(
      (item) => item.drawingId === page.drawingId && item.page === page.page,
    );
    return (
      <>
        <ArrowsOverlay items={pageItems.map(live)} />
        {box && (
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
        )}
      </>
    );
  }

  if (inspection === undefined || drawings === undefined) return null;
  if (!inspection) {
    return <NotFound what="Inspection" />;
  }

  const currentDrawing = drawings.find((d) => d.id === current?.drawingId);
  const showList = drawings.length === 0 || adding.busy || adding.failed;
  const loadError = [...errors.values()][0] ?? backfillError;

  return (
    <section className="drawing-screen">
      <InspectionHeader inspectionId={inspectionId} current="inspection" />
      {loadError && (
        <p role="alert" className="error viewer-alert">
          Could not open a drawing: {loadError}
        </p>
      )}

      <div
        className={`drawing-body${selected || itemsOpen || drawingsOpen ? " with-sheet" : ""}`}
      >
        {showList ? (
          <div className="drawings-empty">
            <DrawingsSection
              inspectionId={inspectionId}
              onActivity={setAdding}
              onOpen={(drawingId) => {
                setAdding({ busy: false, failed: false });
                setScrollTarget({
                  pageKey: pageKey(drawingId, 1),
                  token: Date.now(),
                });
              }}
            />
          </div>
        ) : (
          <div className="viewer-wrap">
            <DocumentViewer
              layout={layout}
              docs={docs}
              pins={pins}
              addPinMode={addPinMode || placingArrow !== null}
              onPlacePin={(page, at) =>
                void (placingArrow ? placeArrow(page, at) : placePin(page, at))
              }
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
              onTapDrawing={() => {
                // Tapping away from the pin closes its editor (text is saved).
                if (!selectedId) return;
                setJustPlaced(null);
                select(null);
              }}
              onSelectArrow={(itemId, arrowId) => {
                select(itemId);
                setSelectedArrow(arrowId);
              }}
              onMoveArrow={(itemId, arrowId, to) =>
                setDraggingArrow({ itemId, arrowId, to })
              }
              onMoveArrowEnd={(itemId, arrowId, to) => {
                const item = items?.find((i) => i.id === itemId);
                if (!item) return;
                setSelectedArrow(arrowId);
                void setArrowsWithUndo(
                  item,
                  (item.arrows ?? []).map((a) =>
                    a.id === arrowId ? { ...a, ...to } : a,
                  ),
                  "Move arrow",
                ).then(() => setDraggingArrow(null));
              }}
              onCurrentPage={setCurrent}
              onActiveDrawings={setNeeded}
              onVisiblePins={(ids) => setPinsInView(new Set(ids))}
              renderPageOverlay={renderPageOverlay}
              scrollTarget={scrollTarget}
              fitRequest={fitRequest}
            />
            {/* Floating over the drawing: they never move it. */}
            <div className="viewer-float viewer-float-top">
              <button
                type="button"
                className={`viewer-chip${drawingsOpen ? " toggle-on" : " quiet"}`}
                aria-label="Drawings"
                aria-pressed={drawingsOpen}
                title="Drawings"
                onClick={() => {
                  setDrawingsOpen((open) => !open);
                  setItemsOpen(false);
                  select(null);
                }}
              >
                <Files aria-hidden="true" />
                <span className="drawing-name" data-testid="page-indicator">
                  {currentDrawing && current
                    ? `${currentDrawing.name} · page ${current.page} of ${current.pageCount}`
                    : ""}
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
            </div>
            {/* Tools: a vertical pill on the left; Add pin first. */}
            <div
              className="viewer-tools"
              role="toolbar"
              aria-label="Drawing tools"
              aria-orientation="vertical"
            >
              <button
                type="button"
                aria-label="Add pin"
                aria-pressed={addPinMode}
                title={addPinMode ? "Tap the drawing…" : "Add pin"}
                className={`tool-add${addPinMode ? " toggle-on" : ""}`}
                onClick={() => {
                  setPlacingArrow(null);
                  setAddPinMode((on) => !on);
                }}
                disabled={layout.pages.length === 0}
              >
                <MapPinPlus aria-hidden="true" />
              </button>
              <QuickPhotoButton inspectionId={inspectionId} />
              <button
                type="button"
                className="icon-button quiet"
                aria-label="Undo"
                disabled={!history.undo}
                title={
                  history.undo
                    ? `Undo: ${history.undo.label}`
                    : "Nothing to undo"
                }
                onClick={() => {
                  // An undone change could leave the open sheet pointing at nothing.
                  select(null);
                  void undoLast(inspectionId);
                }}
              >
                <Undo2 aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button quiet"
                aria-label="Redo"
                disabled={!history.redo}
                title={
                  history.redo
                    ? `Redo: ${history.redo.label}`
                    : "Nothing to redo"
                }
                onClick={() => {
                  select(null);
                  void redoLast(inspectionId);
                }}
              >
                <Redo2 aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button quiet"
                aria-label="Fit page"
                title="Fit page"
                onClick={() => setFitRequest((n) => n + 1)}
              >
                <Maximize aria-hidden="true" />
              </button>
            </div>
            {addPinMode && (
              <p className="viewer-hint" role="status">
                Tap the drawing to place the pin
              </p>
            )}
            <div className="viewer-float viewer-float-bottom">
              <button
                type="button"
                className={`viewer-chip${itemsOpen ? " toggle-on" : " quiet"}`}
                aria-label="Items"
                aria-pressed={itemsOpen}
                title="Items"
                onClick={() => {
                  setItemsOpen((open) => !open);
                  setDrawingsOpen(false);
                  select(null);
                }}
              >
                <List aria-hidden="true" />
                <span>Items</span>
                {(items?.length ?? 0) > 0 && (
                  <span className="count-badge" aria-hidden="true">
                    {items?.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {selected ? (
          <ItemSheet
            key={selected.id}
            item={selected}
            autoFocus={selected.id === justPlaced}
            closeLabel={itemsOpen ? "‹ Items" : "Done"}
            onClose={() => {
              setJustPlaced(null);
              select(null);
            }}
            arrows={{
              placing: placingArrow === selected.id,
              selectedId: selectedArrow,
              message: arrowMessage,
              onAdd: () => {
                setAddPinMode(false);
                setPlacingArrow(selected.id);
                setArrowMessage(null);
              },
              onCancel: () => {
                setPlacingArrow(null);
                setArrowMessage(null);
              },
              onRemove: (arrowId) => {
                setSelectedArrow(null);
                void setArrowsWithUndo(
                  selected,
                  (selected.arrows ?? []).filter((a) => a.id !== arrowId),
                  `Remove arrow from ${kindName(selected.kind).toLowerCase()} ${selected.letter}`,
                );
              },
            }}
          />
        ) : drawingsOpen && drawings.length > 0 ? (
          <aside className="item-sheet drawings-panel" aria-label="Drawings">
            <DrawingsSection
              inspectionId={inspectionId}
              onOpen={(drawingId) =>
                setScrollTarget({
                  pageKey: pageKey(drawingId, 1),
                  token: Date.now(),
                })
              }
            />
          </aside>
        ) : (
          itemsOpen && (
            <ItemsPanel
              items={items ?? []}
              drawings={drawings}
              inView={pinsInView}
              onClose={() => setItemsOpen(false)}
              onSelect={(item) => {
                select(item.id);
                setScrollTarget({
                  pageKey: pageKey(item.drawingId, item.page),
                  at: { x: item.x, y: item.y },
                  token: Date.now(),
                });
              }}
            />
          )
        )}
      </div>
    </section>
  );
}
