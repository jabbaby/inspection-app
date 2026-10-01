import { useRef, useState } from "react";
import type { ObservationBox } from "../../db/types";
import { boxMetrics, clampBoxPosition } from "./observationBox";
import type { Point } from "./viewer/viewTransform";
import { useViewerCoords } from "./viewer/viewerCoords";

interface Props {
  box: ObservationBox;
  header: string;
  /** Shown with the observation lines; omitted when there are none. */
  heading: string;
  lines: string[];
  onMoveEnd: (to: Point) => void;
}

/**
 * The observations box, drawn on the page in page units so it zooms with the
 * drawing and matches the exported PDF. Drag it to move it off detail.
 */
export function ObservationBoxOverlay({
  box,
  header,
  heading,
  lines,
  onMoveEnd,
}: Props) {
  const { pageSize, clientToNormalised } = useViewerCoords();
  const m = boxMetrics(pageSize);
  const [dragPos, setDragPos] = useState<Point | null>(null);
  const drag = useRef<{ pointerId: number; offset: Point; last: Point } | null>(
    null,
  );
  const pos = dragPos ?? box;

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already released.
    }
    const at = clientToNormalised(e.clientX, e.clientY);
    drag.current = {
      pointerId: e.pointerId,
      offset: { x: at.x - box.x, y: at.y - box.y },
      last: { x: box.x, y: box.y },
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const at = clientToNormalised(e.clientX, e.clientY);
    d.last = clampBoxPosition(
      { x: at.x - d.offset.x, y: at.y - d.offset.y },
      pageSize,
    );
    setDragPos(d.last);
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (d.last.x !== box.x || d.last.y !== box.y) onMoveEnd(d.last);
    // Keep showing the dragged spot until the saved position arrives.
    setTimeout(() => setDragPos(null), 300);
  }

  return (
    <div
      className="observation-box"
      data-testid="observation-box"
      data-x={pos.x.toFixed(4)}
      data-y={pos.y.toFixed(4)}
      role="group"
      aria-label="Observations box (drag to move)"
      style={{
        left: pos.x * pageSize.width,
        top: pos.y * pageSize.height,
        width: m.width,
        padding: m.padding,
        fontSize: m.fontSize,
        lineHeight: `${m.lineHeight}px`,
        borderWidth: m.borderWidth,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="observation-box-header">{header}</div>
      {lines.length > 0 && (
        <>
          <div className="observation-box-heading">{heading}</div>
          {lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </>
      )}
    </div>
  );
}
