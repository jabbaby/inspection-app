import { useLiveQuery } from "dexie-react-hooks";
import { Files, List, MapPinPlus, Maximize, Redo2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { readPlace, writePlace } from "../../app/sessionPlace";
import { NotFound } from "../../app/NotFound";
import { redoLast, undoLast, useUndo } from "../../app/undo";
import { db } from "../../db/db";
import { listDrawings, setPageSizes } from "../../db/drawings";
import { moveObservationBox, updateItem } from "../../db/items";
import {
  createItemWithUndo,
  setArrowsWithUndo,
  setKindWithUndo,
  switchNewItemKind,
} from "../items/itemActions";
import { InspectionHeader } from "../inspections/InspectionTabs";
import { QuickPhotoButton } from "../photos/QuickPhotoButton";
import { DrawingsSection } from "./DrawingsSection";
import { kindName } from "../items/letters";
import { ArrowsOverlay } from "./ArrowsOverlay";
import type { Drawing, Item, ItemArrow, ItemKind } from "../../db/types";
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
import { DOUBLE_TAP_MS } from "./document/gestures";
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

/** Milliseconds until a performance.now() time (event handlers only). */
function msUntil(time: number) {
  return time - performance.now();
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

  // The page this inspection's drawings were last open at (this session),
  // read once before the viewer reports its first page.
  const [savedPage] = useState(() => readPlace(`doc-page:${inspectionId}`));

  // Initial scroll: to the selected item, else the requested drawing, else
  // where the drawings were left.
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
    } else if (savedPage && layout.pages.some((p) => p.key === savedPage)) {
      setScrollTarget({ pageKey: savedPage, token: Date.now() });
    }
  }, [layout, items, selected, startDrawing, savedPage]);

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

  async function placePin(
    page: PageLayout,
    at: Point,
    options: { arrows?: ItemArrow[]; kind?: ItemKind; openAt?: number } = {},
  ) {
    setAddPinMode(false);
    cancelPendingOpen();
    const token = openToken.current;
    const item = await createItemWithUndo(
      {
        inspectionId,
        drawingId: page.drawingId,
        page: page.page,
        ...at,
        arrows: options.arrows,
        kind: options.kind,
      },
      defaultBoxPosition(page.size),
    );
    const open = () => {
      pendingOpen.current = 0;
      // Cancelled meanwhile (a double-tap's second press, or another pin).
      if (openToken.current !== token) return;
      setJustPlaced(item.id);
      select(item.id);
    };
    // A tapped pin opens once a double-tap is no longer possible: the
    // editor could cover the spot of the second tap, and a double-tap and
    // hold opens it only when the finger lifts.
    const wait = msUntil(options.openAt ?? 0);
    if (wait > 0) pendingOpen.current = window.setTimeout(open, wait);
    else open();
    return item;
  }

  /** The pin the latest tap placed (it may still be saving), and when. */
  const placedByTap = useRef<{ item: Promise<Item>; time: number } | null>(
    null,
  );
  /** A tapped pin waiting to open (see placePin). */
  const pendingOpen = useRef(0);
  /** Changes when a pending open is cancelled (even before it is timed). */
  const openToken = useRef(0);

  function cancelPendingOpen() {
    window.clearTimeout(pendingOpen.current);
    pendingOpen.current = 0;
    openToken.current++;
  }
  /**
   * The pin a double-tap's second press turned into an observation (or
   * null: it pressed something else), resolved once saved.
   */
  const secondPressed = useRef<Promise<Item | null> | null>(null);

  function openItem(id: string) {
    setJustPlaced(id);
    select(id);
  }

  /**
   * The second press of a double-tap went down. When the first tap placed
   * a pin, it turns into an observation now (same Undo step); its editor
   * waits until the finger lifts, which may be after a hold and an arrow.
   */
  function secondPress(
    target: { pinId: string } | { hit: { page: PageLayout; at: Point } | null },
  ) {
    cancelPendingOpen();
    const placing = placedByTap.current;
    placedByTap.current = null;
    const pinId = "pinId" in target ? target.pinId : null;
    secondPressed.current = (async () => {
      // Only a pin placed by the first tap of this double-tap counts.
      const created =
        placing && performance.now() - placing.time < 1000
          ? await placing.item
          : null;
      if (!created || (pinId !== null && pinId !== created.id)) return null;
      await switchNewItemKind(created, "observation");
      return created;
    })();
  }

  /** What the second press turned (and forgets it). */
  async function takeSecondPressed() {
    const pending = secondPressed.current;
    secondPressed.current = null;
    return pending ? await pending : null;
  }

  function tapDrawing(hit: { page: PageLayout; at: Point } | null) {
    placedByTap.current = null;
    // Tapping the drawing closes what's open beside it: an item's editor
    // first (its text is saved), then the Items or Drawings panel. With
    // nothing open it places an instruction pin.
    if (pendingOpen.current) {
      // The pin just placed, about to open: count it as open.
      cancelPendingOpen();
      return;
    }
    if (selectedId) {
      setJustPlaced(null);
      select(null);
      return;
    }
    if (itemsOpen || drawingsOpen) {
      setItemsOpen(false);
      setDrawingsOpen(false);
      return;
    }
    if (hit) {
      const time = performance.now();
      placedByTap.current = {
        item: placePin(hit.page, hit.at, { openAt: time + DOUBLE_TAP_MS }),
        time,
      };
    }
  }

  /**
   * A tap and hold (then release). An instruction is a new pin, with its
   * arrow if dragged. An observation (double-tap and hold) turns the pin
   * the first tap placed into one, with the arrow, in the same Undo step;
   * on an existing pin it switches the pin and adds the arrow; otherwise
   * it places a new observation.
   */
  async function holdPlace(
    page: PageLayout,
    at: Point,
    tip: Point | null,
    kind: ItemKind,
    pinId: string | null,
  ) {
    const arrows = tip ? [{ id: crypto.randomUUID(), ...tip }] : [];
    placedByTap.current = null;
    if (kind === "instruction") {
      await placePin(page, at, { arrows });
      return;
    }
    // Double-tap and hold: the pin the second press turned gets the arrow.
    const turned = await takeSecondPressed();
    if (turned) {
      const samePage =
        turned.drawingId === page.drawingId && turned.page === page.page;
      if (arrows.length && samePage) {
        await switchNewItemKind(turned, "observation", [
          ...(turned.arrows ?? []),
          ...arrows,
        ]);
      }
      openItem(turned.id);
      return;
    }
    const existing = pinId ? items?.find((i) => i.id === pinId) : undefined;
    if (existing) {
      select(existing.id);
      await setKindWithUndo(existing, "observation");
      if (arrows.length) {
        await setArrowsWithUndo(
          existing,
          [...(existing.arrows ?? []), ...arrows],
          `Add arrow to observation ${existing.letter}`,
        );
      }
      return;
    }
    await placePin(page, at, { arrows, kind: "observation" });
  }

  /**
   * A double-tap lifted: the pin its second press turned into an
   * observation opens; on an existing pin it switches kind.
   */
  async function doubleTap(
    target: { pinId: string } | { hit: { page: PageLayout; at: Point } | null },
  ) {
    placedByTap.current = null;
    const turned = await takeSecondPressed();
    const pinId = "pinId" in target ? target.pinId : null;
    if (turned) {
      openItem(turned.id);
      return;
    }
    if (pinId === null) {
      // The first tap only closed something: this one is a plain tap.
      if ("hit" in target) tapDrawing(target.hit);
      return;
    }
    const item = items?.find((i) => i.id === pinId);
    if (!item) return;
    select(item.id);
    await setKindWithUndo(
      item,
      item.kind === "instruction" ? "observation" : "instruction",
    );
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
              onTapDrawing={tapDrawing}
              onSecondPress={secondPress}
              onDoubleTap={(target) => void doubleTap(target)}
              onHoldPlace={(page, at, tip, kind, pinId) =>
                void holdPlace(page, at, tip, kind, pinId)
              }
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
              onCurrentPage={(page) => {
                setCurrent(page);
                writePlace(`doc-page:${inspectionId}`, page.key);
              }}
              onActiveDrawings={setNeeded}
              onVisiblePins={(ids) => setPinsInView(new Set(ids))}
              renderPageOverlay={renderPageOverlay}
              scrollTarget={scrollTarget}
              coveredBy={() =>
                document.querySelector(".drawing-body > .item-sheet")
              }
              fitRequest={fitRequest}
            />
            {/* Floating over the drawing: they never move it. Both pills sit
                on the right edge (easier for the right hand on site); the
                panels open on the left. */}
            <div className="viewer-controls">
              {/* The page and Items. */}
              <div className="viewer-side">
                <button
                  type="button"
                  className={`side-button${drawingsOpen ? " toggle-on" : ""}`}
                  aria-label="Drawings"
                  aria-pressed={drawingsOpen}
                  title={
                    currentDrawing && current
                      ? `${currentDrawing.name} · page ${current.page} of ${current.pageCount}`
                      : "Drawings"
                  }
                  onClick={() => {
                    setDrawingsOpen((open) => !open);
                    setItemsOpen(false);
                    select(null);
                  }}
                >
                  <Files aria-hidden="true" />
                  <span
                    className="side-label"
                    data-testid="page-indicator"
                    // Which drawing and its own page, for tests and tooltips.
                    data-label={
                      currentDrawing && current
                        ? `${currentDrawing.name} · page ${current.page} of ${current.pageCount}`
                        : ""
                    }
                  >
                    {/* "Page" above "N of M" in the narrow pill. */}
                    {current && (
                      <>
                        Page{" "}
                        <span className="side-label-line">
                          {current.number} of {layout.pages.length}
                        </span>
                      </>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className={`side-button${itemsOpen ? " toggle-on" : ""}`}
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
                  <span className="side-label">
                    Items
                    {(items?.length ?? 0) > 0 && (
                      <span className="count-badge" aria-hidden="true">
                        {items?.length}
                      </span>
                    )}
                  </span>
                </button>
              </div>
              {/* Tools: a vertical pill below; Add pin first. */}
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
            </div>
            {addPinMode && (
              <p className="viewer-hint" role="status">
                Tap the drawing to place the pin
              </p>
            )}
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
