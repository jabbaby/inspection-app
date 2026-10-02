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
  panBy,
  pageToScreen,
  previewTransform,
  screenToPage,
  zoomAt,
  type Point,
  type Size,
  type ViewTransform,
} from "../viewer/viewTransform";
import { kindName } from "../../items/letters";
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
  /** Arrow tips (normalised on the pin's page); handles show when selected. */
  arrows: { id: string; x: number; y: number }[];
  selectedArrowId: string | null;
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
  /** Arrow tip handles (the selected item's): tap selects, drag moves. */
  onSelectArrow: (itemId: string, arrowId: string) => void;
  onMoveArrow: (itemId: string, arrowId: string, to: Point) => void;
  onMoveArrowEnd: (itemId: string, arrowId: string, to: Point) => void;
  /** The page at the centre of the view changed. */
  onCurrentPage: (page: PageLayout) => void;
  /** Drawings with pages on or near the screen (their PDFs are needed). */
  onActiveDrawings: (drawingIds: string[]) => void;
  /** Items whose pins are on screen changed. */
  onVisiblePins: (itemIds: string[]) => void;
  renderPageOverlay: (page: PageLayout) => ReactNode;
  scrollTarget: ScrollTarget | null;
  /** Change to fit the current page to the view. */
  fitRequest: number;
}

const TAP_SLOP = 10;
const TAP_MS = 600;
const SETTLE_MS = 160;
const PAD = 16;
/** A touch this soon after the view scrolled stops the scroll; it isn't a tap. */
const SCROLL_STOP_MS = 120;

interface Tracked extends Point {
  type: string;
}

/** The parts of a touch the pinch needs (tests can supply plain objects). */
interface TouchLike {
  clientX: number;
  clientY: number;
  touchType?: string;
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
 * (GoodNotes style). One-finger scrolling is the browser's own (on iPad:
 * Safari's 120 Hz scrolling with iOS momentum and bounce). Two fingers
 * pinch-zoom; mouse drags pan, the wheel scrolls and ctrl+wheel zooms. At
 * fit width the document is exactly as wide as the view, so it can't move
 * sideways. Apple Pencil never scrolls (reserved for markup); it only acts
 * while placing a pin. Only pages on or near the screen are rendered.
 *
 * The scroll container's content is the document at the current zoom: a
 * point at document units (x, y) sits at (padX + x * scale, PAD + y * scale)
 * in the content. `transform` describes the same view as before
 * (screen = doc * scale + offset), derived from the scroll position.
 */
export function DocumentViewer(props: Props) {
  const { layout, docs, pins, addPinMode, scrollTarget, fitRequest } = props;
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const transform = useRef<ViewTransform>({ scale: 1, x: PAD, y: PAD });
  const viewSize = useRef<Size>({ width: 0, height: 0 });
  const fitWidthScale = useRef(1);
  /** What the content is currently sized for. */
  const applied = useRef({ scale: 0, viewWidth: 0, docHeight: 0 });
  const lastScroll = useRef(-Infinity);
  const frame = useRef(0);
  const settleTimer = useRef(0);
  const currentKey = useRef<string | null>(null);
  const visiblePinsKey = useRef<string | null>(null);
  const visiblePinsTimer = useRef(0);
  /** Cancels page drawing in progress (pages register while drawing). */
  const renderCancels = useRef(new Set<() => void>());
  const registerRender = useCallback((cancel: () => void) => {
    renderCancels.current.add(cancel);
    return () => {
      renderCancels.current.delete(cancel);
    };
  }, []);
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

  /** Left margin of the document in the content (centres it when narrow). */
  function padX(scale: number) {
    return Math.max(PAD, (viewSize.current.width - DOC_WIDTH * scale) / 2);
  }

  function visibleDocRange(t: ViewTransform) {
    const top = screenToPage(t, { x: 0, y: 0 });
    const bottom = screenToPage(t, {
      x: viewSize.current.width,
      y: viewSize.current.height,
    });
    return { top, bottom };
  }

  function positionPins() {
    const scale = applied.current.scale;
    const left = padX(scale);
    for (const pin of latest.current.pins) {
      const el = pinEls.current.get(pin.id);
      const page = pagesRef.current.get(pin.pageKey);
      if (!el || !page) continue;
      const p = pagePointToDoc(page, pin);
      el.style.transform = `translate(${left + p.x * scale}px, ${PAD + p.y * scale}px)`;
      for (const arrow of pin.arrows) {
        const handle = pinEls.current.get(`${pin.id}:${arrow.id}`);
        if (!handle) continue;
        const a = pagePointToDoc(page, arrow);
        handle.style.transform = `translate(${left + a.x * scale}px, ${PAD + a.y * scale}px)`;
      }
    }
  }

  /** Sizes the content for a zoom level (only when something changed). */
  function applyScale(scale: number) {
    const docHeight = currentLayout().height;
    const a = applied.current;
    if (
      a.scale === scale &&
      a.viewWidth === viewSize.current.width &&
      a.docHeight === docHeight
    )
      return;
    applied.current = {
      scale,
      viewWidth: viewSize.current.width,
      docHeight,
    };
    const left = padX(scale);
    const width = DOC_WIDTH * scale + 2 * left;
    // At (or below) fit width there's nothing to see sideways: lock it.
    const fits = width <= viewSize.current.width + 0.5;
    containerRef.current!.style.overflowX = fits ? "hidden" : "auto";
    Object.assign(sizerRef.current!.style, {
      width: `${fits ? viewSize.current.width : width}px`,
      height: `${Math.max(docHeight, 1) * scale + 2 * PAD}px`,
    });
    stageRef.current!.style.transform = `translate(${left}px, ${PAD}px) scale(${scale})`;
    positionPins();
  }

  function layoutFrame() {
    frame.current = 0;
    const t = transform.current;
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
    // Which pins are on screen, once movement pauses (it re-renders the
    // Items list, which mustn't happen every frame of a scroll).
    window.clearTimeout(visiblePinsTimer.current);
    visiblePinsTimer.current = window.setTimeout(reportVisiblePins, 120);
  }

  /** Tells the parent which pins are on screen (the Items list highlights them). */
  function reportVisiblePins() {
    const t = transform.current;
    const { width, height } = viewSize.current;
    const onScreen = latest.current.pins
      .filter((pin) => {
        const page = pagesRef.current.get(pin.pageKey);
        if (!page) return false;
        const p = pageToScreen(t, pagePointToDoc(page, pin));
        return p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height;
      })
      .map((pin) => pin.id)
      .sort()
      .join(",");
    if (onScreen !== visiblePinsKey.current) {
      visiblePinsKey.current = onScreen;
      latest.current.onVisiblePins(onScreen ? onScreen.split(",") : []);
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

  /**
   * The view from the live scroll position. Pointer handlers call this
   * rather than trusting the last scroll event, which the browser may not
   * have delivered yet (it fires once per frame).
   */
  function currentTransform(): ViewTransform {
    const c = containerRef.current!;
    const scale = applied.current.scale;
    transform.current = {
      scale,
      x: padX(scale) - c.scrollLeft,
      y: PAD - c.scrollTop,
    };
    return transform.current;
  }

  /** Reads the view from the scroll position (the browser keeps it in range). */
  function readScroll() {
    currentTransform();
    requestLayout();
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, SETTLE_MS);
  }

  function setTransform(next: ViewTransform) {
    applyScale(next.scale);
    const c = containerRef.current!;
    c.scrollLeft = padX(next.scale) - next.x;
    c.scrollTop = PAD - next.y;
    readScroll();
  }

  function zoomLimits() {
    return {
      min: fitWidthScale.current * 0.3,
      max: Math.max(fitWidthScale.current * 24, 4),
    };
  }

  function measure() {
    const c = containerRef.current!;
    viewSize.current = { width: c.clientWidth, height: c.clientHeight };
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
    measure();
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
    positionPins();
    // Added, moved or deleted pins can change which are on screen.
    requestLayout();
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
    const observer = new ResizeObserver(() => {
      const old = viewSize.current;
      const { clientWidth: width, clientHeight: height } = container;
      if (width === old.width && height === old.height) return;
      const wasFitWidth =
        Math.abs(currentTransform().scale - fitWidthScale.current) < 1e-6;
      const widthChanged = Math.abs(width - old.width) > 1;
      const centreDocY = screenToPage(currentTransform(), {
        x: 0,
        y: old.height / 2,
      }).y;
      measure();
      // Rotation / split view: keep fit-width if it was. Height-only changes
      // (an item sheet opening below) keep the view where it is.
      if (wasFitWidth && widthChanged) {
        const scale = fitWidthScale.current;
        setTransform({ scale, x: PAD, y: height / 2 - centreDocY * scale });
        return;
      }
      setTransform(keepSelectedVisible(currentTransform()));
    });
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current);
      cancelAnimationFrame(frame.current);
      window.clearTimeout(visiblePinsTimer.current);
    },
    [],
  );

  // --- input --------------------------------------------------------------

  const pointers = useRef(new Map<number, Tracked>());
  const tap = useRef<{ id: number; start: Point; time: number } | null>(null);
  /** A touch that stopped a scroll: it never counts as a tap. */
  const stopTouch = useRef<number | null>(null);
  const pinch = useRef<{
    startDist: number;
    startMid: Point;
    /** The viewer's top-left on screen. */
    origin: Point;
    /** Pending preview update (one per frame). */
    frame: number;
    /** The view when the pinch started (what the content is laid out for). */
    base: ViewTransform;
    scroll: Point;
    /** The view the fingers are asking for; laid out when they lift. */
    target: ViewTransform;
  } | null>(null);
  const dragging = useRef<{
    id: string;
    /** Set when dragging one of the pin's arrow tips instead of the pin. */
    arrowId: string | null;
    pointerId: number;
    start: Point;
    moved: boolean;
    last: Point | null;
  } | null>(null);

  function local(e: { clientX: number; clientY: number }): Point {
    const box = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }

  function penDown() {
    return [...pointers.current.values()].some((p) => p.type === "pen");
  }

  // Runs before pins and the notes box see the touch. A touch that lands
  // while the document is scrolling only stops it: on a pin or the box it
  // is swallowed; on the drawing it never places a pin.
  function onPointerDownCapture(e: React.PointerEvent) {
    if (performance.now() - lastScroll.current > SCROLL_STOP_MS) return;
    if (e.pointerType === "mouse") return;
    stopTouch.current = e.pointerId;
    if (
      (e.target as Element).closest(
        ".viewer-pin, .arrow-handle, .observation-box",
      )
    )
      e.stopPropagation();
  }

  function onPointerDown(e: React.PointerEvent) {
    // A first finger (or the mouse) means nothing else is down: forget any
    // pointer whose "up" was lost, or every later tap would look like part
    // of a two-finger gesture and Add pin would stop working.
    if (e.isPrimary) pointers.current.clear();
    // Pencil is reserved for markup; it only acts while placing a pin.
    if (e.pointerType === "pen" && !latest.current.addPinMode) {
      pointers.current.set(e.pointerId, { ...local(e), type: "pen" });
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Stop a mouse drag from selecting text around the viewer.
    if (e.pointerType === "mouse") {
      e.preventDefault();
      capture(e);
    }
    const p = local(e);
    pointers.current.set(e.pointerId, { ...p, type: e.pointerType });
    tap.current =
      pointers.current.size === 1
        ? { id: e.pointerId, start: p, time: e.timeStamp }
        : null;
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, { ...p, type: prev.type });
    const pending = tap.current;
    if (pending?.id === e.pointerId) {
      if (Math.hypot(p.x - pending.start.x, p.y - pending.start.y) < TAP_SLOP)
        return;
      tap.current = null;
      // Touch scrolling is the browser's; only a mouse drag pans here.
      if (prev.type === "mouse") {
        setTransform(
          panBy(
            currentTransform(),
            p.x - pending.start.x,
            p.y - pending.start.y,
          ),
        );
      }
      return;
    }
    if (prev.type === "mouse" && !tap.current) {
      setTransform(panBy(currentTransform(), p.x - prev.x, p.y - prev.y));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const pending = tap.current;
    tap.current = null;
    const stoppedScroll = stopTouch.current === e.pointerId;
    if (stoppedScroll) stopTouch.current = null;
    if (
      e.type === "pointerup" &&
      !stoppedScroll &&
      pending?.id === e.pointerId &&
      e.timeStamp - pending.time < TAP_MS &&
      latest.current.addPinMode
    ) {
      const hit = hitPage(
        currentLayout(),
        screenToPage(currentTransform(), local(e)),
      );
      if (hit) latest.current.onPlacePin(hit.page, hit.at);
    }
  }

  // Native scrolling, touch pinch, Pencil and wheel zoom.
  useEffect(() => {
    const container = containerRef.current!;
    const onScroll = () => {
      lastScroll.current = performance.now();
      readScroll();
    };

    const fingers = (list: ArrayLike<TouchLike>) =>
      Array.from(list).filter((t) => t.touchType !== "stylus");
    const hasStylus = (list: ArrayLike<TouchLike>) =>
      Array.from(list).some((t) => t.touchType === "stylus");
    const pinchOf = (pair: TouchLike[], origin: Point) => {
      const [a, b] = pair.map((t) => ({
        x: t.clientX - origin.x,
        y: t.clientY - origin.y,
      }));
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    };
    // Pinch (as pdf.js does it): while the fingers are down the content is
    // only scaled as a picture with a CSS transform, so nothing is laid out
    // or scrolled mid-gesture (Safari's async scrolling would fight it).
    // When the fingers lift, the new zoom is laid out once.
    const startPinch = (list: TouchLike[]) => {
      // Measured once: the viewer doesn't move during a pinch.
      const box = container.getBoundingClientRect();
      const origin = { x: box.left, y: box.top };
      const start = pinchOf(list, origin);
      const base = currentTransform();
      pinch.current = {
        startDist: start.dist,
        startMid: start.mid,
        origin,
        base,
        scroll: { x: container.scrollLeft, y: container.scrollTop },
        target: base,
        frame: 0,
      };
      // Nothing else on the main thread mid-pinch: no pending sharpen, and
      // no page drawing in progress (it redraws after the fingers lift).
      window.clearTimeout(settleTimer.current);
      for (const cancel of renderCancels.current) cancel();
      sizerRef.current!.style.willChange = "transform";
    };
    const endPinch = () => {
      const p = pinch.current;
      if (!p) return;
      pinch.current = null;
      cancelAnimationFrame(p.frame);
      Object.assign(sizerRef.current!.style, {
        transform: "",
        willChange: "",
      });
      setTransform(p.target);
    };
    const onTouchStart = (e: TouchEvent) => {
      const list = fingers(e.touches);
      if (list.length < 2) return;
      // Two fingers: our pinch, not the browser's scroll or zoom.
      e.preventDefault();
      tap.current = null;
      if (!pinch.current) startPinch(list);
    };
    const onTouchMove = (e: TouchEvent) => {
      // Pencil never scrolls (iPad marks it "stylus"; elsewhere a pen
      // pointer is down).
      if (hasStylus(e.touches) || penDown()) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      const list = fingers(e.touches);
      const p = pinch.current;
      if (list.length < 2 || !p) return;
      if (e.cancelable) e.preventDefault();
      const now = pinchOf(list, p.origin);
      // Always from the start of the gesture, so nothing accumulates.
      p.target = panBy(
        zoomAt(p.base, now.dist / p.startDist, p.startMid, zoomLimits()),
        now.mid.x - p.startMid.x,
        now.mid.y - p.startMid.y,
      );
      // At most one style change per frame, however fast touches arrive.
      if (!p.frame) {
        p.frame = requestAnimationFrame(() => {
          p.frame = 0;
          const t = previewTransform(p.base, p.target, p.scroll);
          sizerRef.current!.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k})`;
        });
      }
    };
    /** A pointer lifted anywhere: stop tracking it (the viewer may have missed it). */
    const forgetPointer = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (tap.current?.id === e.pointerId) tap.current = null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const list = fingers(e.touches);
      if (!pinch.current) return;
      endPinch();
      // Still two fingers down (a third lifted): carry on from here.
      if (list.length >= 2) startPinch(list);
    };

    // Plain wheel and trackpad scrolling are native; pinch / ctrl+wheel zooms.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setTransform(
        zoomAt(
          currentTransform(),
          Math.exp(-e.deltaY * 0.01),
          local(e),
          zoomLimits(),
        ),
      );
    };
    const stopGesture = (e: Event) => e.preventDefault();
    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    // Ends are heard on the whole document: a touch whose target was removed
    // or redrawn mid-gesture never bubbles its end up to the viewer.
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("pointerup", forgetPointer);
    window.addEventListener("pointercancel", forgetPointer);
    container.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("gesturestart", stopGesture);
    document.addEventListener("gesturechange", stopGesture);
    return () => {
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("pointerup", forgetPointer);
      window.removeEventListener("pointercancel", forgetPointer);
      container.removeEventListener("wheel", onWheel);
      document.removeEventListener("gesturestart", stopGesture);
      document.removeEventListener("gesturechange", stopGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- pins ---------------------------------------------------------------

  function pinPosition(pin: DocPin, p: Point): Point {
    const page = pagesRef.current.get(pin.pageKey)!;
    const doc = screenToPage(currentTransform(), p);
    return clampNormalised({
      x: doc.x / DOC_WIDTH,
      y: (doc.y - page.top) / page.height,
    });
  }

  function onPinPointerDown(
    e: React.PointerEvent,
    id: string,
    arrowId: string | null = null,
  ) {
    e.stopPropagation();
    capture(e);
    dragging.current = {
      id,
      arrowId,
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
    if (drag.arrowId)
      latest.current.onMoveArrow(drag.id, drag.arrowId, drag.last);
    else latest.current.onMovePin(drag.id, drag.last);
  }

  function onPinPointerUp(e: React.PointerEvent) {
    const drag = dragging.current;
    if (drag?.pointerId !== e.pointerId) return;
    dragging.current = null;
    if (e.type !== "pointerup") return;
    if (drag.arrowId) {
      if (drag.moved && drag.last)
        latest.current.onMoveArrowEnd(drag.id, drag.arrowId, drag.last);
      else if (!drag.moved) latest.current.onSelectArrow(drag.id, drag.arrowId);
      return;
    }
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
              currentTransform(),
              local({ clientX, clientY }),
            );
            return {
              x: doc.x / DOC_WIDTH,
              y: (doc.y - page.top) / page.height,
            };
          },
        ]),
      ),
    // local() and currentTransform() only read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div ref={sizerRef} className="doc-sizer">
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
              registerRender={registerRender}
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
              aria-label={`${kindName(pin.kind)} pin ${pin.letter}`}
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
          {pins
            .filter((pin) => pin.selected)
            .flatMap((pin) =>
              pin.arrows.map((arrow, i) => (
                <button
                  key={`${pin.id}:${arrow.id}`}
                  type="button"
                  className={[
                    "arrow-handle",
                    arrow.id === pin.selectedArrowId
                      ? "arrow-handle-selected"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-testid="arrow-handle"
                  data-x={arrow.x.toFixed(4)}
                  data-y={arrow.y.toFixed(4)}
                  aria-label={`Arrow ${i + 1} of ${kindName(pin.kind).toLowerCase()} ${pin.letter}`}
                  aria-pressed={arrow.id === pin.selectedArrowId}
                  ref={(el) => {
                    const key = `${pin.id}:${arrow.id}`;
                    if (el) pinEls.current.set(key, el);
                    else pinEls.current.delete(key);
                  }}
                  onPointerDown={(e) => onPinPointerDown(e, pin.id, arrow.id)}
                  onPointerMove={(e) => onPinPointerMove(e, pin)}
                  onPointerUp={onPinPointerUp}
                  onPointerCancel={onPinPointerUp}
                />
              )),
            )}
        </div>
      </div>
    </div>
  );
}
