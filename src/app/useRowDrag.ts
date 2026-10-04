import { useRef, useState } from "react";

interface Drag {
  id: string;
  pointerId: number;
  /** Row boxes when the drag started (screen px), in list order. */
  rows: { top: number; height: number }[];
  startY: number;
  dy: number;
}

/** Where the dragged row would land, as an index in the list. */
function dropIndex(ids: string[], drag: Drag): number {
  const from = ids.indexOf(drag.id);
  const row = drag.rows[from];
  const mid = row.top + row.height / 2 + drag.dy;
  return drag.rows.filter(
    (other, i) => i !== from && other.top + other.height / 2 < mid,
  ).length;
}

/**
 * Drag a row's ≡ handle to reorder a list (as in the Items panel). Rows
 * should be about the same height. `onReorder` gets the ids in their new
 * order.
 */
export function useRowDrag(
  ids: string[],
  onReorder: (order: string[]) => void,
) {
  const rowEls = useRef(new Map<string, HTMLElement>());
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };

  const rowRef = (id: string) => (el: HTMLElement | null) => {
    if (el) rowEls.current.set(id, el);
    else rowEls.current.delete(id);
  };

  const handleProps = (id: string) => ({
    onPointerDown(e: React.PointerEvent) {
      e.stopPropagation();
      if (e.pointerType === "mouse") e.preventDefault();
      const rows = ids.map((other) => {
        const box = rowEls.current.get(other)?.getBoundingClientRect();
        return { top: box?.top ?? 0, height: box?.height ?? 0 };
      });
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Pointer already released.
      }
      setDrag({ id, pointerId: e.pointerId, rows, startY: e.clientY, dy: 0 });
    },
    onPointerMove(e: React.PointerEvent) {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const row = d.rows[ids.indexOf(d.id)];
      const first = d.rows[0];
      const last = d.rows[d.rows.length - 1];
      // Up to half a row past either end, so a hairline between rows
      // (unequal heights) can't stop a row reaching the top or bottom.
      const slack = row.height / 2;
      const dy = Math.min(
        last.top - row.top + slack,
        Math.max(first.top - row.top - slack, e.clientY - d.startY),
      );
      setDrag({ ...d, dy });
    },
    onPointerUp(e: React.PointerEvent) {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const from = ids.indexOf(d.id);
      const to = dropIndex(ids, d);
      setDrag(null);
      if (e.type !== "pointerup" || to === from) return;
      const order = ids.filter((other) => other !== d.id);
      order.splice(to, 0, d.id);
      onReorder(order);
    },
    onPointerCancel(e: React.PointerEvent) {
      const d = dragRef.current;
      if (d && d.pointerId === e.pointerId) setDrag(null);
    },
  });

  /** How far a row is shifted while a row is dragged (px). */
  const shift = (id: string): number => {
    if (!drag) return 0;
    if (id === drag.id) return drag.dy;
    const i = ids.indexOf(id);
    const from = ids.indexOf(drag.id);
    const to = dropIndex(ids, drag);
    const step =
      drag.rows.length > 1
        ? drag.rows[1].top - drag.rows[0].top
        : drag.rows[from].height;
    if (from < to && i > from && i <= to) return -step;
    if (from > to && i >= to && i < from) return step;
    return 0;
  };

  return { rowRef, handleProps, shift, draggingId: drag?.id ?? null };
}
