import { useRef, useState, type ReactNode } from "react";

/** How far a row slides to show its Delete button (px). */
const REVEAL = 96;
/** Movement before a press becomes a swipe (px). */
const SLOP = 8;

/**
 * A list row that slides left to show a Delete button (iOS style). A tap
 * on an open row closes it instead of following the row's link; vertical
 * drags still scroll the list.
 */
export function SwipeToDelete({
  label,
  onDelete,
  children,
}: {
  /** The Delete button's accessible name, e.g. "Delete Level 3 slab". */
  label: string;
  onDelete: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const press = useRef<{
    pointerId: number;
    x: number;
    y: number;
    base: number;
    dx: number;
    swiping: boolean;
  } | null>(null);
  // A swipe (or closing an open row) ends with a click: swallow it.
  const swallowClick = useRef(false);

  const offset = dragX ?? (open ? -REVEAL : 0);

  return (
    <li className="swipe-delete-row">
      <button
        type="button"
        className="swipe-delete"
        aria-label={label}
        // Only reachable once the row is swiped open.
        aria-hidden={open ? undefined : true}
        tabIndex={open ? 0 : -1}
        onClick={() => {
          setOpen(false);
          onDelete();
        }}
      >
        Delete
      </button>
      <div
        className="swipe-delete-content"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragX === null ? undefined : "none",
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const base = open ? -REVEAL : 0;
          press.current = {
            pointerId: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            base,
            dx: base,
            swiping: false,
          };
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (!p || p.pointerId !== e.pointerId) return;
          const dx = e.clientX - p.x;
          const dy = e.clientY - p.y;
          if (!p.swiping) {
            if (Math.hypot(dx, dy) < SLOP) return;
            // Mostly vertical: leave it to the page's own scrolling.
            if (Math.abs(dy) >= Math.abs(dx)) {
              press.current = null;
              return;
            }
            p.swiping = true;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Pointer already released.
            }
          }
          p.dx = Math.min(0, Math.max(-REVEAL * 1.3, p.base + dx));
          setDragX(p.dx);
        }}
        onPointerUp={(e) => {
          const p = press.current;
          if (!p || p.pointerId !== e.pointerId) return;
          press.current = null;
          if (!p.swiping) return;
          swallowClick.current = true;
          // Not every swipe ends with a click; don't eat a later tap.
          window.setTimeout(() => (swallowClick.current = false), 350);
          setOpen(p.dx < -REVEAL / 2);
          setDragX(null);
        }}
        onPointerCancel={() => {
          press.current = null;
          setDragX(null);
        }}
        // A link inside mustn't start a native link drag (it would cancel
        // the swipe).
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          // The click that ends a swipe: ignore it (the swipe chose).
          if (swallowClick.current) {
            e.preventDefault();
            e.stopPropagation();
            swallowClick.current = false;
            return;
          }
          // A tap on an open row closes it instead of opening the link.
          if (open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {children}
      </div>
    </li>
  );
}
