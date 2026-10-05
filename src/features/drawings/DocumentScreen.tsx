import { useLiveQuery } from "dexie-react-hooks";
import { Files, List, Maximize, Redo2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { readPlace, writePlace } from "../../app/sessionPlace";
import { NotFound } from "../../app/NotFound";
import { redoLast, undoLast, useUndo } from "../../app/undo";
import { db } from "../../db/db";
import { listDrawings, setPageSizes } from "../../db/drawings";
import { listMarkups } from "../../db/markups";
import { HIGHLIGHTER_OPACITY, toStoredPoints } from "../markup/markGeometry";
import { drawWithUndo, eraseWithUndo } from "../markup/markupActions";
import { toolColour, useMarkupPrefs } from "../markup/markupPrefs";
import { MarkupOverlay } from "../markup/MarkupOverlay";
import { MarkupToolbar } from "../markup/MarkupToolbar";
import type { DocMark, ViewerTool } from "../markup/tools";
import { moveObservationBox, updateCopy, updateItem } from "../../db/items";
import {
  createItemWithUndo,
  setArrowsWithUndo,
  addCopyWithUndo,
  removeSpotWithUndo,
  setKindWithUndo,
  switchNewItemKind,
} from "../items/itemActions";
import { InspectionHeader } from "../inspections/InspectionTabs";
import { QuickPhotoButton } from "../photos/QuickPhotoButton";
import { DrawingsSection } from "./DrawingsSection";
import { PagesSheet } from "./PagesSheet";
import { kindName } from "../items/letters";
import { ArrowsOverlay } from "./ArrowsOverlay";
import {
  isOnPage,
  itemSpots,
  parseSpotKey,
  type PinSpot,
} from "../items/spots";
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
import { ExportedLettersNotice } from "../export/ExportedLettersNotice";
import {
  DEFAULT_OBSERVATION_HEADING,
  boxHeader,
  boxLines,
  defaultBoxPosition,
  observationHeading,
} from "./observationBox";
import type { Point } from "./viewer/viewTransform";

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
  const marks = useLiveQuery(
    () => listMarkups(db, inspectionId),
    [inspectionId],
  );
  const heading = useLiveQuery(async () => {
    const headings = await db.snippets
      .where("kind")
      .equals("heading")
      .toArray();
    return observationHeading(headings);
  }, []);

  const history = useUndo(inspectionId);
  // The markup toolbar's tool: none when the drawings open (SPEC 5a).
  const [tool, setTool] = useState<ViewerTool | null>(null);
  const prefs = useMarkupPrefs();
  // Marks the eraser is passing over: hidden until it lifts.
  const [erasing, setErasing] = useState<Set<string>>(() => new Set());
  const [itemsOpen, setItemsOpen] = useState(false);
  // Opened with ?pages=1 from the Drawings card on Pre-inspection.
  const [pagesOpen, setPagesOpen] = useState(() => params.get("pages") === "1");
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
    /** The pin's spot key (an item id, or "itemId~copyId" for a copy). */
    key: string;
    arrowId: string;
    to: Point;
  } | null>(null);
  // Copy pin: the item whose copies each tap on the drawing places.
  const [copying, setCopying] = useState<string | null>(null);

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
          .map((d) => ({
            id: d.id,
            name: d.name,
            pageSizes: d.pageSizes!,
            pages: d.pages,
          })),
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
      // Its first visible page (page 1 may be hidden).
      const first = layout.pages.find((p) => p.drawingId === startDrawing);
      if (first) setScrollTarget({ pageKey: first.key, token: Date.now() });
    } else if (savedPage && layout.pages.some((p) => p.key === savedPage)) {
      setScrollTarget({ pageKey: savedPage, token: Date.now() });
    }
  }, [layout, items, selected, startDrawing, savedPage]);

  /** A pin as shown right now: the pin or an arrow tip mid-drag included. */
  function live(spot: PinSpot): PinSpot {
    const arrows = spot.arrows.map((arrow) =>
      draggingArrow?.key === spot.key && draggingArrow.arrowId === arrow.id
        ? { ...arrow, ...draggingArrow.to }
        : arrow,
    );
    return { ...spot, ...(dragging[spot.key] ?? {}), arrows };
  }

  // One pin per spot: an item's original and its copies share its letter.
  const pins: DocPin[] = (items ?? []).flatMap((item) =>
    itemSpots(item).map((spot) => {
      const shown = live(spot);
      return {
        id: spot.key,
        letter: item.letter,
        kind: item.kind,
        selected: item.id === selectedId,
        pageKey: pageKey(spot.drawingId, spot.page),
        x: shown.x,
        y: shown.y,
        arrows: shown.arrows,
        selectedArrowId: item.id === selectedId ? selectedArrow : null,
      };
    }),
  );

  const docMarks: DocMark[] = (marks ?? [])
    .filter((m) => !erasing.has(m.id))
    .map((m) => ({
      id: m.id,
      pageKey: pageKey(m.drawingId, m.page),
      tool: m.tool,
      points: m.points,
      colour: m.colour,
      weight: m.weight,
    }));
  const inkTool = tool === "highlighter" ? "highlighter" : "pen";

  async function saveStroke(page: PageLayout, points: Point[]) {
    if (tool !== "pen" && tool !== "highlighter") return;
    await drawWithUndo({
      inspectionId,
      drawingId: page.drawingId,
      page: page.page,
      tool,
      // Already normalised: stored rounded.
      points: toStoredPoints(points, { width: 1, height: 1 }),
      colour: toolColour(prefs, tool),
      weight: prefs.weight[tool],
    });
  }

  function erase(ids: string[], done: boolean) {
    if (!done) return setErasing(new Set(ids));
    const gone = (marks ?? []).filter((m) => ids.includes(m.id));
    void eraseWithUndo(inspectionId, gone).finally(() => setErasing(new Set()));
  }

  const itemOf = (key: string) =>
    items?.find((i) => i.id === parseSpotKey(key).itemId);

  /** "Page 4": a page's number through the document. */
  const pageLabel = (drawingId: string, page: number) =>
    `Page ${layout.pages.find((p) => p.drawingId === drawingId && p.page === page)?.number ?? "?"}`;

  function select(itemId: string | null) {
    const next: Record<string, string> = {};
    if (itemId) next.item = itemId;
    setParams(next, { replace: true });
    if (itemId !== selectedId) {
      setSelectedArrow(null);
      setPlacingArrow(null);
      setArrowMessage(null);
      setCopying(null);
    }
  }

  async function placeArrow(page: PageLayout, at: Point) {
    const item = items?.find((i) => i.id === placingArrow);
    if (!item) return setPlacingArrow(null);
    // Arrows stay on a pin's page: the item's pin on the tapped page (the
    // nearest, if it has copies there) gets it.
    const spots = itemSpots(item);
    const onPage = spots.filter(
      (s) => s.drawingId === page.drawingId && s.page === page.page,
    );
    if (onPage.length === 0) {
      const pages = [
        ...new Set(spots.map((s) => pageLabel(s.drawingId, s.page))),
      ];
      setArrowMessage(
        `Tap on ${pages.join(" or ").toLowerCase()}, where the pin is.`,
      );
      return;
    }
    const spot = onPage.reduce((best, s) =>
      Math.hypot(s.x - at.x, s.y - at.y) <
      Math.hypot(best.x - at.x, best.y - at.y)
        ? s
        : best,
    );
    const arrow = { id: crypto.randomUUID(), ...at };
    setPlacingArrow(null);
    setArrowMessage(null);
    await setArrowsWithUndo(
      item,
      [...spot.arrows, arrow],
      `Add arrow to ${kindName(item.kind).toLowerCase()} ${item.letter}`,
      spot.copyId,
    );
    setSelectedArrow(arrow.id);
  }

  /** Copy pin: each tap pins the item again (it stays on until Done). */
  async function placeCopy(page: PageLayout, at: Point) {
    const item = items?.find((i) => i.id === copying);
    if (!item) return setCopying(null);
    await addCopyWithUndo(
      item,
      { drawingId: page.drawingId, page: page.page, ...at },
      defaultBoxPosition(page.size),
    );
  }

  async function placePin(
    page: PageLayout,
    at: Point,
    options: { arrows?: ItemArrow[]; kind?: ItemKind; openAt?: number } = {},
  ) {
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
      // Its double-tap window is over: a later double-tap on it switches
      // its kind (its own Undo step) rather than finishing this tap.
      placedByTap.current = null;
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
      if (
        !created ||
        (pinId !== null && parseSpotKey(pinId).itemId !== created.id)
      )
        return null;
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
    // nothing open and the Pin tool on, it places an instruction pin.
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
    if (itemsOpen) {
      setItemsOpen(false);
      return;
    }
    if (hit && tool === "pin") {
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
    const existing = pinId ? itemOf(pinId) : undefined;
    if (existing && pinId) {
      select(existing.id);
      await setKindWithUndo(existing, "observation");
      const spot = itemSpots(existing).find((s) => s.key === pinId);
      if (arrows.length && spot) {
        await setArrowsWithUndo(
          existing,
          [...spot.arrows, ...arrows],
          `Add arrow to observation ${existing.letter}`,
          spot.copyId,
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
    const item = itemOf(pinId);
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
    // Items with a pin (original or copy) here: the notes box lists them.
    const pageItems = (items ?? []).filter((item) =>
      isOnPage(item, page.drawingId, page.page),
    );
    const pageSpots = pageItems.flatMap((item) =>
      itemSpots(item)
        .filter((s) => s.drawingId === page.drawingId && s.page === page.page)
        .map((s) => ({ ...live(s), id: s.key, kind: item.kind })),
    );
    return (
      <>
        <MarkupOverlay marks={docMarks.filter((m) => m.pageKey === page.key)} />
        <ArrowsOverlay items={pageSpots} />
        {box && (
          <ObservationBoxOverlay
            box={box}
            lines={boxLines({
              header: boxHeader(inspection),
              observationHeading: heading ?? DEFAULT_OBSERVATION_HEADING,
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
      {drawings.length > 0 && <MarkupToolbar tool={tool} onTool={setTool} />}
      {loadError && (
        <p role="alert" className="error viewer-alert">
          Could not open a drawing: {loadError}
        </p>
      )}

      <div
        className={`drawing-body${selected || itemsOpen ? " with-sheet" : ""}`}
      >
        {showList ? (
          <div className="drawings-empty">
            <DrawingsSection
              inspectionId={inspectionId}
              onActivity={setAdding}
              onOpen={(drawingId) => {
                setAdding({ busy: false, failed: false });
                setScrollTarget({
                  // A new drawing shows every page: page 1 is its first.
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
              tool={tool}
              fingerDraw={prefs.fingerDraw}
              marks={docMarks}
              ink={{
                colour: toolColour(prefs, inkTool),
                weight: prefs.weight[inkTool],
                opacity: inkTool === "highlighter" ? HIGHLIGHTER_OPACITY : 1,
              }}
              onStroke={saveStroke}
              onErase={erase}
              addPinMode={placingArrow !== null || copying !== null}
              onPlacePin={(page, at) =>
                void (copying
                  ? placeCopy(page, at)
                  : placingArrow
                    ? placeArrow(page, at)
                    : placePin(page, at))
              }
              onMovePin={(key, to) => setDragging((d) => ({ ...d, [key]: to }))}
              onMovePinEnd={(key, to) => {
                const { itemId, copyId } = parseSpotKey(key);
                void (
                  copyId
                    ? updateCopy(db, itemId, copyId, to)
                    : updateItem(db, itemId, to)
                ).then(() =>
                  setDragging((d) => {
                    const rest = { ...d };
                    delete rest[key];
                    return rest;
                  }),
                );
              }}
              onSelectPin={(key) => select(parseSpotKey(key).itemId)}
              onTapDrawing={tapDrawing}
              onSecondPress={secondPress}
              onDoubleTap={(target) => void doubleTap(target)}
              onHoldPlace={(page, at, tip, kind, pinId) =>
                void holdPlace(page, at, tip, kind, pinId)
              }
              onSelectArrow={(key, arrowId) => {
                select(parseSpotKey(key).itemId);
                setSelectedArrow(arrowId);
              }}
              onMoveArrow={(key, arrowId, to) =>
                setDraggingArrow({ key, arrowId, to })
              }
              onMoveArrowEnd={(key, arrowId, to) => {
                const item = itemOf(key);
                const spot = item && itemSpots(item).find((s) => s.key === key);
                if (!item || !spot) return;
                setSelectedArrow(arrowId);
                void setArrowsWithUndo(
                  item,
                  spot.arrows.map((a) =>
                    a.id === arrowId ? { ...a, ...to } : a,
                  ),
                  "Move arrow",
                  spot.copyId,
                ).then(() => setDraggingArrow(null));
              }}
              onCurrentPage={(page) => {
                setCurrent(page);
                writePlace(`doc-page:${inspectionId}`, page.key);
              }}
              onActiveDrawings={setNeeded}
              onVisiblePins={(keys) =>
                setPinsInView(new Set(keys.map((k) => parseSpotKey(k).itemId)))
              }
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
                  className="side-button"
                  aria-label="Pages"
                  aria-haspopup="dialog"
                  title={
                    currentDrawing && current
                      ? `${currentDrawing.name} · page ${current.source} of ${current.pageCount}`
                      : "Pages"
                  }
                  onClick={() => {
                    setPagesOpen(true);
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
                        ? `${currentDrawing.name} · page ${current.source} of ${current.pageCount}`
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
              {/* Tools: a vertical pill below (pins and markup are in the
                  toolbar above the drawing). */}
              <div
                className="viewer-tools"
                role="toolbar"
                aria-label="Drawing tools"
                aria-orientation="vertical"
              >
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
            {copying && selected && (
              <p className="viewer-hint viewer-hint-copy" role="status">
                Tap each spot for a copy of {kindName(selected.kind)}{" "}
                {selected.letter}
                <button type="button" onClick={() => setCopying(null)}>
                  Done
                </button>
              </p>
            )}
            {items && tool !== "pin" && (
              <ExportedLettersNotice
                inspectionId={inspectionId}
                items={items}
              />
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
                setCopying(null);
                setPlacingArrow(selected.id);
                setArrowMessage(null);
              },
              onCancel: () => {
                setPlacingArrow(null);
                setArrowMessage(null);
              },
              onRemove: (arrowId) => {
                const spot = itemSpots(selected).find((s) =>
                  s.arrows.some((a) => a.id === arrowId),
                );
                if (!spot) return;
                setSelectedArrow(null);
                void setArrowsWithUndo(
                  selected,
                  spot.arrows.filter((a) => a.id !== arrowId),
                  `Remove arrow from ${kindName(selected.kind).toLowerCase()} ${selected.letter}`,
                  spot.copyId,
                );
              },
            }}
            copies={{
              copying: copying === selected.id,
              spots: itemSpots(selected).map((s) => ({
                key: s.key,
                copyId: s.copyId,
                label: pageLabel(s.drawingId, s.page),
              })),
              onCopy: () => {
                setPlacingArrow(null);
                setArrowMessage(null);
                setCopying(selected.id);
              },
              onStop: () => setCopying(null),
              onGoTo: (key) => {
                const spot = itemSpots(selected).find((s) => s.key === key);
                if (spot)
                  setScrollTarget({
                    pageKey: pageKey(spot.drawingId, spot.page),
                    at: { x: spot.x, y: spot.y },
                    token: Date.now(),
                  });
              },
              onRemove: (copyId) => void removeSpotWithUndo(selected, copyId),
            }}
          />
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
      <PagesSheet
        open={pagesOpen}
        inspectionId={inspectionId}
        drawings={drawings}
        items={items ?? []}
        marks={marks ?? []}
        currentKey={current?.key ?? null}
        onGoTo={(key) => setScrollTarget({ pageKey: key, token: Date.now() })}
        onClose={() => {
          setPagesOpen(false);
          if (params.has("pages")) setParams({}, { replace: true });
        }}
      />
    </section>
  );
}
