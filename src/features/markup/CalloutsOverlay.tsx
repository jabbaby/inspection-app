import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useViewerCoords } from "../drawings/viewer/viewerCoords";
import type { Point } from "../drawings/viewer/viewTransform";
import {
  calloutMetrics,
  calloutPlace,
  calloutPoints,
  calloutSize,
  calloutText,
  layoutCallout,
} from "./calloutGeometry";
import { measureArial } from "./measureText";
import type { DocMark } from "./tools";

/** A callout being typed: new (no id yet) or an existing one. */
export interface CalloutDraft {
  /** The mark being edited, or null for a new one. */
  id: string | null;
  /** Box top-left and leader tip, normalised on the page. */
  box: Point;
  tip: Point | null;
  text: string;
  colour: string;
  /** Text size (fraction of the sheet's short side). */
  size: number;
}

interface Props {
  callouts: DocMark[];
  /** A callout being typed on this page. */
  draft: CalloutDraft | null;
  /** The Text tool is on: the arrow tips show their handles. */
  interactive: boolean;
  onEdit: (mark: DocMark) => void;
  onDraftText: (text: string) => void;
  /** Typing finished (the box lost focus). */
  onDone: () => void;
  /** A callout's box or tip was dragged: its new points. */
  onMove: (mark: DocMark, points: number[]) => void;
}

/** iOS zooms the page into any text box under 16 px: type at 16 px or more. */
const MIN_INPUT_PX = 16;
/** Screen px of grab area round a callout's box and its arrow tip. */
const BOX_REACH_PX = 14;
const TIP_REACH_PX = 22;
/** Screen px radius of the tip handle shown with the Text tool on. */
const HANDLE_PX = 7;

/**
 * A page's text callouts (SPEC section 5a): white boxes of capitals with a
 * thin border in their colour and an optional leader arrow, in page units
 * like the notes box. Like a pin, tapping one edits it, dragging its box
 * moves it, and dragging its tip re-points the leader.
 */
export const CalloutsOverlay = memo(function CalloutsOverlay({
  callouts,
  draft,
  interactive,
  onEdit,
  onDraftText,
  onDone,
  onMove,
}: Props) {
  const { pageSize, clientToNormalised } = useViewerCoords();
  const { width, height } = pageSize;
  const [moving, setMoving] = useState<{ id: string; points: number[] } | null>(
    null,
  );
  const drag = useRef<{
    pointerId: number;
    mark: DocMark;
    part: "box" | "tip";
    start: Point;
    moved: boolean;
    points: number[];
  } | null>(null);

  const shown = useMemo(
    () =>
      callouts
        .filter((m) => m.id !== draft?.id)
        .map((m) => (moving?.id === m.id ? { ...m, points: moving.points } : m))
        .map((mark) => ({
          mark,
          layout: layoutCallout(mark, { width, height }, measureArial),
        })),
    [callouts, draft?.id, moving, width, height],
  );

  // Like a pin: tapped or dragged whatever tool is on (the viewer keeps
  // the Pencil for drawing tools before it gets here).
  function down(e: React.PointerEvent, mark: DocMark, part: "box" | "tip") {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already released.
    }
    drag.current = {
      pointerId: e.pointerId,
      mark,
      part,
      start: clientToNormalised(e.clientX, e.clientY),
      moved: false,
      points: mark.points,
    };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const at = clientToNormalised(e.clientX, e.clientY);
    const dx = at.x - d.start.x;
    const dy = at.y - d.start.y;
    if (!d.moved && Math.hypot(dx * width, dy * height) < 4) return;
    d.moved = true;
    const p = [...d.mark.points];
    if (d.part === "box") {
      p[0] += dx;
      p[1] += dy;
    } else {
      p[4] = Math.min(1, Math.max(0, at.x));
      p[5] = Math.min(1, Math.max(0, at.y));
    }
    d.points = p;
    setMoving({ id: d.mark.id, points: p });
  }

  function up(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return onEdit(d.mark);
    onMove(d.mark, d.points);
    // Keep showing the dragged spot until the saved one arrives.
    setTimeout(() => setMoving(null), 300);
  }

  // The callout being typed shows its leader too (its box is the editor).
  const draftLeader = useMemo(() => {
    if (!draft?.tip) return null;
    const size = { width, height };
    const box = calloutSize(
      draft.text || "W",
      calloutMetrics(draft.size, size),
      measureArial,
    );
    const points = calloutPoints(
      {
        box: { x: draft.box.x * width, y: draft.box.y * height, ...box },
        tip: { x: draft.tip.x * width, y: draft.tip.y * height },
      },
      size,
    );
    return layoutCallout(
      { points, weight: draft.size, text: "" },
      size,
      measureArial,
    ).leader;
  }, [draft, width, height]);

  // Page units per screen px at the current zoom, so grab areas stay
  // finger-sized however far in or out the drawing is.
  const origin = clientToNormalised(0, 0);
  const across = clientToNormalised(100, 0);
  const unitsPerPx = Math.max(
    1e-6,
    (Math.hypot(
      (across.x - origin.x) * width,
      (across.y - origin.y) * height,
    ) || 1) / 100,
  );

  if (shown.length === 0 && !draft) return null;
  return (
    <>
      <svg
        className={`callouts-overlay${interactive ? " callouts-live" : ""}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {draft && draftLeader && (
          <g aria-hidden="true">
            <line
              x1={draftLeader.from.x}
              y1={draftLeader.from.y}
              x2={draftLeader.to.x}
              y2={draftLeader.to.y}
              stroke={draft.colour}
              strokeWidth={draftLeader.width}
              strokeLinecap="round"
            />
            <polygon
              points={draftLeader.head.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={draft.colour}
            />
          </g>
        )}
        {shown.map(({ mark, layout }) => {
          const { box, metrics, lines, leader } = layout;
          return (
            <g
              key={mark.id}
              className="callout"
              data-testid="callout"
              aria-label={mark.text}
            >
              {leader && (
                <>
                  <line
                    x1={leader.from.x}
                    y1={leader.from.y}
                    x2={leader.to.x}
                    y2={leader.to.y}
                    stroke={mark.colour}
                    strokeWidth={leader.width}
                    strokeLinecap="round"
                  />
                  <polygon
                    points={leader.head.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill={mark.colour}
                  />
                </>
              )}
              <rect
                x={box.x + metrics.border / 2}
                y={box.y + metrics.border / 2}
                width={box.width - metrics.border}
                height={box.height - metrics.border}
                fill="#fff"
                stroke={mark.colour}
                strokeWidth={metrics.border}
              />
              {/* Grab areas: round the box, and the tip. */}
              <rect
                className="callout-hit"
                data-testid="callout-box"
                x={box.x - BOX_REACH_PX * unitsPerPx}
                y={box.y - BOX_REACH_PX * unitsPerPx}
                width={box.width + 2 * BOX_REACH_PX * unitsPerPx}
                height={box.height + 2 * BOX_REACH_PX * unitsPerPx}
                fill="transparent"
                onPointerDown={(e) => down(e, mark, "box")}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
              />
              {leader && interactive && (
                <circle
                  className="callout-handle"
                  cx={leader.head[0].x}
                  cy={leader.head[0].y}
                  r={HANDLE_PX * unitsPerPx}
                  fill="#fff"
                  stroke={mark.colour}
                  strokeWidth={2 * unitsPerPx}
                />
              )}
              {leader && (
                <circle
                  className="callout-hit"
                  data-testid="callout-tip"
                  cx={leader.head[0].x}
                  cy={leader.head[0].y}
                  r={TIP_REACH_PX * unitsPerPx}
                  fill="transparent"
                  onPointerDown={(e) => down(e, mark, "tip")}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                />
              )}
              {lines.map((line, i) => (
                <text
                  key={i}
                  x={line.x}
                  y={line.baseline}
                  fontFamily="Arial, Helvetica, sans-serif"
                  fontSize={metrics.fontSize}
                  fill={mark.colour}
                  pointerEvents="none"
                >
                  {line.text}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
      {draft && (
        <CalloutEditor draft={draft} onText={onDraftText} onDone={onDone} />
      )}
    </>
  );
});

/** The box being typed in: grows as the text does, then wraps. */
function CalloutEditor({
  draft,
  onText,
  onDone,
}: {
  draft: CalloutDraft;
  onText: (text: string) => void;
  onDone: () => void;
}) {
  const { pageSize } = useViewerCoords();
  const ref = useRef<HTMLTextAreaElement>(null);
  const m = calloutMetrics(draft.size, pageSize);
  const size = calloutSize(draft.text || "W", m, measureArial);
  const place = calloutPlace(
    { points: [draft.box.x, draft.box.y, 0, 0] },
    pageSize,
  );
  // Laid out at least MIN_INPUT_PX and scaled down to the callout's size.
  const k = Math.max(1, MIN_INPUT_PX / m.fontSize);

  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
  }, []);

  return (
    <textarea
      ref={ref}
      className="callout-editor"
      aria-label="Callout text"
      value={calloutText(draft.text)}
      onChange={(e) => onText(e.target.value)}
      onBlur={onDone}
      onPointerDown={(e) => e.stopPropagation()}
      rows={1}
      style={{
        left: place.box.x,
        top: place.box.y,
        width: size.width * k,
        height: size.height * k,
        fontSize: m.fontSize * k,
        lineHeight: `${m.lineHeight * k}px`,
        padding: m.padding * k,
        borderWidth: m.border * k,
        borderColor: draft.colour,
        color: draft.colour,
        transform: `scale(${1 / k})`,
      }}
    />
  );
}
