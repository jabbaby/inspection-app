import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PDFDocumentProxy } from "../pdf/pdfjs";
import {
  clampNormalised,
  clampTransform,
  panBy,
  pageToScreen,
  screenToPage,
  zoomAt,
  type Point,
  type Size,
  type ViewTransform,
} from "../viewer/viewTransform";
import {
  chooseAxis,
  isRolling,
  lockToAxis,
  releaseVelocity,
  rollStep,
  trimSamples,
  type Axis,
  type Sample,
} from "../viewer/momentum";
import { DocPage, type SettledView } from "./DocPage";
import {
  DOC_WIDTH,
  LABEL_HEIGHT,
  hitPage,
  pageAtY,
  pagePointToDoc,
  pagesInRange,
  type DocumentLayout,
  type PageLayout,
} from "./documentLayout";

export interface DocPin {
  id: string;
  letter: string;
  pageKey: string;
  /** Normalised position on its page (0..1). */
  x: number;
  y: number;
  kind: "instruction" | "observation";
  selected: boolean;
}

/** Where to scroll: a drawing's first page, or a point on a page. */
export interface ScrollTarget {
  pageKey: string;
  at?: Point;
  /** Change to repeat a request for the same target. */
  token: number;
}

interface Props {
  layout: DocumentLayout;
  docs: Map<string, PDFDocumentProxy>;
  pins: DocPin[];
  /** While true, the next tap (finger, Pencil or mouse) places a pin. */
  addPinMode: boolean;
  onPlacePin: (page: PageLayout, at: Point) => void;
  onMovePin: (id: string, to: Point) => void;
  onMovePinEnd: (id: string, to: Point) => void;
  onSelectPin: (id: string) => void;
  /** The page at the centre of the view changed. */
  onCurrentPage: (page: PageLayout) => void;
  /** Drawings with pages on or near the screen (their PDFs are needed). */
  onActiveDrawings: (drawingIds: string[]) => void;
  renderPageOverlay: (page: PageLayout) => ReactNode;
  scrollTarget: ScrollTarget | null;
  /** Change to fit the current page to the view. */
  fitRequest: number;
}

const TAP_SLOP = 10;
const TAP_MS = 600;
const SETTLE_MS = 160;
const PAD = 16;

interface Tracked extends Point {
  type: string;
}

function capture(e: React.PointerEvent) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // Pointer already released.
  }
}

/**
 * Every page of every drawing in one continuous, vertically stacked document
 * (GoodNotes style): one finger scrolls and pans, two fingers pinch-zoom,
 * mouse drags and wheel/trackpad scroll or zoom. Drags lock to the axis they
 * start along, and a finger flick keeps rolling (see momentum.ts). Apple Pencil input is
 * ignored (reserved for markup) except while placing a pin. Only pages on
 * or near the screen are rendered; the rest release their memory.
 */
export function DocumentViewer(props: Props) {
  const { layout, docs, pins, addPinMode, scrollTarget, fitRequest } = props;
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const transform = useRef<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const viewSize = useRef<Size>({ width: 0, height: 0 });
  const fitWidthScale = useRef(1);
  const frame = useRef(0);
  const settleTimer = useRef(0);
  const currentKey = useRef<string | null>(null);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(() => new Set());
  const [settled, setSettled] = useState<SettledView | null>(null);
  const [renderedKeys, setRenderedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [currentPageKey, setCurrentPageKey] = useState<string | null>(null);

  const pagesByKey = useMemo(
    () => new Map(layout.pages.map((p) => [p.key, p])),
    [layout],
  );
  // Handlers outlive renders, so they read the latest layout through refs.
  const pagesRef = useRef(pagesByKey);
  useLayoutEffect(() => {
    pagesRef.current = pagesByKey;
  });
  const currentLayout = () => latest.current.layout;

  // --- layout -------------------------------------------------------------

  function visibleDocRange(t: ViewTransform) {
    const top = screenToPage(t, { x: 0, y: 0 });
    const bottom = screenToPage(t, {
      x: viewSize.current.width,
      y: viewSize.current.height,
    });
    return { top, bottom };
  }

  function layoutFrame() {
    frame.current = 0;
    const t = transform.current;
    if (stageRef.current) {
      stageRef.current.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
    }
    for (const pin of latest.current.pins) {
      const el = pinEls.current.get(pin.id);
      const page = pagesRef.current.get(pin.pageKey);
      if (!el || !page) continue;
      const p = pageToScreen(t, pagePointToDoc(page, pin));
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
    // Pages within one screen above/below stay rendered.
    const { top, bottom } = visibleDocRange(t);
    const span = bottom.y - top.y;
    const active = pagesInRange(currentLayout(), top.y, bottom.y, span);
    setActiveKeys((old) => {
      const next = new Set(active.map((p) => p.key));
      return next.size === old.size && [...next].every((k) => old.has(k))
        ? old
        : next;
    });
    const centre = pageAtY(currentLayout(), (top.y + bottom.y) / 2);
    if (centre && centre.key !== currentKey.current) {
      currentKey.current = centre.key;
      setCurrentPageKey(centre.key);
      latest.current.onCurrentPage(centre);
    }
  }

  function requestLayout() {
    if (!frame.current) frame.current = requestAnimationFrame(layoutFrame);
  }

  function settle() {
    const t = transform.current;
    const { top, bottom } = visibleDocRange(t);
    const dpr = window.devicePixelRatio || 1;
    setSettled({
      docRect: {
        x: top.x,
        y: top.y,
        width: bottom.x - top.x,
        height: bottom.y - top.y,
      },
      devicePxPerDocUnit: t.scale * dpr,
      fitDevicePxPerDocUnit: fitWidthScale.current * dpr,
      visibleCount: Math.max(
        1,
        pagesInRange(currentLayout(), top.y, bottom.y).length,
      ),
    });
  }

  /** Moves the view (clamped to the document) without stopping a roll. */
  function applyTransform(next: ViewTransform) {
    const docSize = {
      width: DOC_WIDTH,
      height: Math.max(currentLayout().height, 1),
    };
    transform.current = clampTransform(next, docSize, viewSize.current, 80);
    requestLayout();
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, SETTLE_MS);
  }

  /** Moves the view; anything that moves it stops a roll first. */
  function setTransform(next: ViewTransform) {
    stopRoll();
    applyTransform(next);
  }

  // --- roll (momentum after a flick) --------------------------------------

  const roll = useRef<{ v: Point; last: number; frame: number } | null>(null);

  /** Stops a roll; true if one was running. */
  function stopRoll() {
    if (!roll.current) return false;
    cancelAnimationFrame(roll.current.frame);
    roll.current = null;
    return true;
  }

  function startRoll(v: Point) {
    stopRoll();
    if (!isRolling(v)) return;
    const step = (now: number) => {
      const r = roll.current;
      if (!r) return;
      const { move, v: nextV } = rollStep(r.v, Math.min(now - r.last, 50));
      const before = transform.current;
      applyTransform(panBy(before, move.x, move.y));
      const after = transform.current;
      // Stop on an axis that reached the end of the document.
      const blocked = (moved: number, wanted: number) =>
        Math.abs(moved) < Math.abs(wanted) - 0.5;
      r.v = {
        x: blocked(after.x - before.x, move.x) ? 0 : nextV.x,
        y: blocked(after.y - before.y, move.y) ? 0 : nextV.y,
      };
      r.last = now;
      if (isRolling(r.v)) r.frame = requestAnimationFrame(step);
      else roll.current = null;
    };
    roll.current = {
      v,
      last: performance.now(),
      frame: requestAnimationFrame(step),
    };
  }

  function zoomLimits() {
    return {
      min: fitWidthScale.current * 0.3,
      max: Math.max(fitWidthScale.current * 24, 4),
    };
  }

  function computeFitWidth() {
    fitWidthScale.current = Math.max(
      0.01,
      (viewSize.current.width - 2 * PAD) / DOC_WIDTH,
    );
  }

  /** Whole page in view, centred. */
  function fitPage(page: PageLayout): ViewTransform {
    const { width, height } = viewSize.current;
    const scale = Math.min(
      (width - 2 * PAD) / DOC_WIDTH,
      (height - 2 * PAD) / page.height,
    );
    return {
      scale,
      x: (width - DOC_WIDTH * scale) / 2,
      y: (height - page.height * scale) / 2 - page.top * scale,
    };
  }

  /** Fit width with a drawing's name label at the top of the view. */
  function topOfPage(page: PageLayout): ViewTransform {
    const scale = fitWidthScale.current;
    const labelTop = page.page === 1 ? page.top - LABEL_HEIGHT : page.top;
    return { scale, x: PAD, y: PAD - labelTop * scale };
  }

  function keepSelectedVisible(t: ViewTransform): ViewTransform {
    const pin = latest.current.pins.find((p) => p.selected);
    const page = pin && pagesRef.current.get(pin.pageKey);
    if (!pin || !page) return t;
    const p = pageToScreen(t, pagePointToDoc(page, pin));
    const margin = 40;
    const { width, height } = viewSize.current;
    const dx =
      p.x < margin
        ? margin - p.x
        : p.x > width - margin
          ? width - margin - p.x
          : 0;
    const dy =
      p.y < margin
        ? margin - p.y
        : p.y > height - margin
          ? height - margin - p.y
          : 0;
    return dx || dy ? panBy(t, dx, dy) : t;
  }

  // First layout, and whenever the set of pages changes.
  const initialised = useRef(false);
  useLayoutEffect(() => {
    const box = containerRef.current!.getBoundingClientRect();
    viewSize.current = { width: box.width, height: box.height };
    computeFitWidth();
    if (!initialised.current && layout.pages.length) {
      initialised.current = true;
      transform.current = { scale: fitWidthScale.current, x: PAD, y: PAD };
    }
    setTransform(transform.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // Scroll requests (opening at a drawing or an item).
  useEffect(() => {
    if (!scrollTarget) return;
    const page = pagesRef.current.get(scrollTarget.pageKey);
    if (!page) return;
    if (scrollTarget.at) {
      const fitted = fitPage(page);
      const p = pageToScreen(fitted, pagePointToDoc(page, scrollTarget.at));
      const { width, height } = viewSize.current;
      // Fit the page, then centre the point if it would be near an edge.
      const inView =
        p.x > 40 && p.x < width - 40 && p.y > 40 && p.y < height - 40;
      setTransform(
        inView ? fitted : panBy(fitted, width / 2 - p.x, height / 2 - p.y),
      );
    } else {
      setTransform(topOfPage(page));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget?.token, scrollTarget?.pageKey, layout]);

  useEffect(() => {
    if (!fitRequest) return;
    const page = currentKey.current && pagesRef.current.get(currentKey.current);
    if (page) setTransform(fitPage(page));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);

  useLayoutEffect(() => {
    layoutFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins]);

  // Tell the parent which drawings' PDFs are needed.
  const activeDrawingsKey = [
    ...new Set(
      [...activeKeys].map((k) => pagesByKey.get(k)?.drawingId).filter(Boolean),
    ),
  ]
    .sort()
    .join(",");
  useEffect(() => {
    latest.current.onActiveDrawings(
      activeDrawingsKey ? activeDrawingsKey.split(",") : [],
    );
  }, [activeDrawingsKey]);

  // Follow container size changes.
  useEffect(() => {
    const container = containerRef.current!;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const old = viewSize.current;
      if (width === old.width && height === old.height) return;
      const wasFitWidth =
        Math.abs(transform.current.scale - fitWidthScale.current) < 1e-6;
      const widthChanged = Math.abs(width - old.width) > 1;
      viewSize.current = { width, height };
      computeFitWidth();
      // Rotation / split view: keep fit-width if it was. Height-only changes
      // (an item sheet opening below) keep the view where it is.
      if (wasFitWidth && widthChanged) {
        const t = transform.current;
        const centreDocY = screenToPage(t, { x: 0, y: old.height / 2 }).y;
        const scale = fitWidthScale.current;
        setTransform({ scale, x: PAD, y: height / 2 - centreDocY * scale });
        return;
      }
      setTransform(keepSelectedVisible(transform.current));
    });
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current);
      cancelAnimationFrame(frame.current);
      stopRoll();
    },
    [],
  );

  // --- input --------------------------------------------------------------

  const pointers = useRef(new Map<number, Tracked>());
  const tap = useRef<{ id: number; start: Point; time: number } | null>(null);
  const pinch = useRef<{ dist: number; mid: Point } | null>(null);
  /** Axis of the current one-pointer drag (null until it starts moving). */
  const axis = useRef<Axis | null>(null);
  /** Recent positions of a one-pointer drag, for the release speed. */
  const samples = useRef<Sample[]>([]);
  /** A touch that stopped a roll: it never counts as a tap. */
  const stopTouch = useRef<number | null>(null);
  const dragging = useRef<{
    id: string;
    pointerId: number;
    start: Point;
    moved: boolean;
    last: Point | null;
  } | null>(null);

  function local(e: { clientX: number; clientY: number }): Point {
    const box = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }

  function touchPair(): [Tracked, Tracked] | null {
    const list = [...pointers.current.values()].filter((p) => p.type !== "pen");
    return list.length >= 2 ? [list[0], list[1]] : null;
  }

  function startPinch() {
    const pair = touchPair();
    pinch.current = pair
      ? {
          dist: Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y),
          mid: {
            x: (pair[0].x + pair[1].x) / 2,
            y: (pair[0].y + pair[1].y) / 2,
          },
        }
      : null;
  }

  // Runs before pins and the notes box see the touch. A touch that stops a
  // roll only stops it: on a pin or the box it is swallowed; on the drawing
  // it can still drag, but never places a pin.
  function onPointerDownCapture(e: React.PointerEvent) {
    if (!stopRoll()) return;
    stopTouch.current = e.pointerId;
    if ((e.target as Element).closest(".viewer-pin, .observation-box"))
      e.stopPropagation();
  }

  function onPointerDown(e: React.PointerEvent) {
    // Pencil is reserved for markup; it only acts while placing a pin.
    if (e.pointerType === "pen" && !latest.current.addPinMode) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Stop a mouse drag from selecting text around the viewer.
    if (e.pointerType === "mouse") e.preventDefault();
    capture(e);
    const p = local(e);
    pointers.current.set(e.pointerId, { ...p, type: e.pointerType });
    if (pointers.current.size === 1) {
      tap.current = { id: e.pointerId, start: p, time: e.timeStamp };
      samples.current = [{ ...p, t: performance.now() }];
    } else {
      tap.current = null;
      axis.current = null;
      samples.current = [];
      startPinch();
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, { ...p, type: prev.type });

    const pair = touchPair();
    if (pair && pinch.current) {
      const dist = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      const mid = {
        x: (pair[0].x + pair[1].x) / 2,
        y: (pair[0].y + pair[1].y) / 2,
      };
      let next = zoomAt(
        transform.current,
        dist / pinch.current.dist,
        mid,
        zoomLimits(),
      );
      next = panBy(
        next,
        mid.x - pinch.current.mid.x,
        mid.y - pinch.current.mid.y,
      );
      pinch.current = { dist, mid };
      setTransform(next);
      return;
    }
    if (prev.type === "pen" || pointers.current.size !== 1) return;

    const now = performance.now();
    samples.current = trimSamples([...samples.current, { ...p, t: now }], now);
    const pending = tap.current;
    if (pending && pending.id === e.pointerId) {
      // Don't move until it's clearly a drag, then pick its axis and catch up.
      const dx = p.x - pending.start.x;
      const dy = p.y - pending.start.y;
      if (Math.hypot(dx, dy) < TAP_SLOP) return;
      tap.current = null;
      axis.current = chooseAxis(dx, dy);
      const d = lockToAxis(axis.current, { x: dx, y: dy });
      setTransform(panBy(transform.current, d.x, d.y));
      return;
    }
    // After a pinch the remaining finger pans freely.
    const d = lockToAxis(axis.current ?? "free", {
      x: p.x - prev.x,
      y: p.y - prev.y,
    });
    setTransform(panBy(transform.current, d.x, d.y));
  }

  function onPointerUp(e: React.PointerEvent) {
    const released = pointers.current.get(e.pointerId);
    if (!released) return;
    const soleDrag =
      pointers.current.size === 1 && !pinch.current && axis.current !== null;
    pointers.current.delete(e.pointerId);
    const pending = tap.current;
    tap.current = null;
    const stoppedRoll = stopTouch.current === e.pointerId;
    if (stoppedRoll) stopTouch.current = null;
    // A finger flick keeps rolling along the drag's axis.
    if (e.type === "pointerup" && soleDrag && released.type === "touch") {
      const v = releaseVelocity(samples.current, performance.now());
      startRoll(lockToAxis(axis.current!, v));
    }
    if (pointers.current.size === 0) {
      axis.current = null;
      samples.current = [];
    }
    if (
      e.type === "pointerup" &&
      !stoppedRoll &&
      pending?.id === e.pointerId &&
      e.timeStamp - pending.time < TAP_MS &&
      latest.current.addPinMode
    ) {
      const hit = hitPage(
        currentLayout(),
        screenToPage(transform.current, local(e)),
      );
      if (hit) latest.current.onPlacePin(hit.page, hit.at);
    }
    if (touchPair()) startPinch();
    else pinch.current = null;
  }

  // Wheel: trackpad pinch / ctrl+wheel zooms, plain wheel scrolls.
  useEffect(() => {
    const container = containerRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        setTransform(
          zoomAt(
            transform.current,
            Math.exp(-e.deltaY * 0.01),
            local(e),
            zoomLimits(),
          ),
        );
      } else {
        setTransform(panBy(transform.current, -e.deltaX, -e.deltaY));
      }
    };
    const stopGesture = (e: Event) => e.preventDefault();
    container.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("gesturestart", stopGesture);
    document.addEventListener("gesturechange", stopGesture);
    return () => {
      container.removeEventListener("wheel", onWheel);
      document.removeEventListener("gesturestart", stopGesture);
      document.removeEventListener("gesturechange", stopGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // --- pins ---------------------------------------------------------------

  function pinPosition(pin: DocPin, p: Point): Point {
    const page = pagesRef.current.get(pin.pageKey)!;
    const doc = screenToPage(transform.current, p);
    return clampNormalised({
      x: doc.x / DOC_WIDTH,
      y: (doc.y - page.top) / page.height,
    });
  }

  function onPinPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    capture(e);
    dragging.current = {
      id,
      pointerId: e.pointerId,
      start: local(e),
      moved: false,
      last: null,
    };
  }

  function onPinPointerMove(e: React.PointerEvent, pin: DocPin) {
    const drag = dragging.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const p = local(e);
    if (
      !drag.moved &&
      Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < TAP_SLOP
    )
      return;
    drag.moved = true;
    drag.last = pinPosition(pin, p);
    latest.current.onMovePin(drag.id, drag.last);
  }

  function onPinPointerUp(e: React.PointerEvent) {
    const drag = dragging.current;
    if (drag?.pointerId !== e.pointerId) return;
    dragging.current = null;
    if (e.type !== "pointerup") return;
    if (drag.moved && drag.last)
      latest.current.onMovePinEnd(drag.id, drag.last);
    else if (!drag.moved) latest.current.onSelectPin(drag.id);
  }

  // Each page's overlay converts pointer positions relative to that page.
  const coordFns = useMemo(
    () =>
      new Map(
        layout.pages.map((page) => [
          page.key,
          (clientX: number, clientY: number): Point => {
            const doc = screenToPage(
              transform.current,
              local({ clientX, clientY }),
            );
            return {
              x: doc.x / DOC_WIDTH,
              y: (doc.y - page.top) / page.height,
            };
          },
        ]),
      ),
    // local() and transform only read refs.

    [layout],
  );

  const onRendered = useCallback((key: string) => {
    setRenderedKeys((old) => (old.has(key) ? old : new Set(old).add(key)));
  }, []);

  const ready = currentPageKey !== null && renderedKeys.has(currentPageKey);

  return (
    <div
      ref={containerRef}
      className={`viewer${addPinMode ? " viewer-add-pin" : ""}`}
      data-testid="drawing-viewer"
      data-ready={ready}
      onPointerDownCapture={onPointerDownCapture}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={stageRef}
        className="doc-stage"
        style={{ width: DOC_WIDTH, height: layout.height }}
      >
        {layout.labels.map((label) => (
          <div
            key={label.drawingId}
            className="doc-label"
            style={{ top: label.top, height: LABEL_HEIGHT }}
          >
            {label.name}
          </div>
        ))}
        {layout.pages.map((page) => (
          <DocPage
            key={page.key}
            page={page}
            doc={docs.get(page.drawingId)}
            active={activeKeys.has(page.key)}
            view={settled}
            overlay={
              activeKeys.has(page.key) ? props.renderPageOverlay(page) : null
            }
            clientToNormalised={coordFns.get(page.key)!}
            onRendered={onRendered}
          />
        ))}
      </div>
      <div className="viewer-pins">
        {pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            className={[
              "viewer-pin",
              pin.kind === "observation" ? "viewer-pin-observation" : "",
              pin.selected ? "viewer-pin-selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-testid="viewer-pin"
            data-kind={pin.kind}
            data-letter={pin.letter}
            data-page={pin.pageKey}
            data-x={pin.x.toFixed(4)}
            data-y={pin.y.toFixed(4)}
            aria-label={`Pin ${pin.letter}`}
            ref={(el) => {
              if (el) pinEls.current.set(pin.id, el);
              else pinEls.current.delete(pin.id);
            }}
            onPointerDown={(e) => onPinPointerDown(e, pin.id)}
            onPointerMove={(e) => onPinPointerMove(e, pin)}
            onPointerUp={onPinPointerUp}
            onPointerCancel={onPinPointerUp}
          >
            {pin.letter}
          </button>
        ))}
      </div>
    </div>
  );
}
