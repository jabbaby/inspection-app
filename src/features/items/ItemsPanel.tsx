import { useRef, useState } from "react";
import type { Drawing, Item } from "../../db/types";
import { deleteItemWithUndo, reorderItemsWithUndo } from "./itemActions";
import { compareItems, groupItems, kindName } from "./letters";

interface Props {
  items: Item[];
  drawings: Drawing[];
  /** Items whose pins are on screen: highlighted. */
  inView: Set<string>;
  onSelect: (item: Item) => void;
  onClose: () => void;
}

/** How far a row slides to show its Delete button (px). */
const REVEAL = 88;
/** Movement before a press becomes a swipe or a drag (px). */
const SLOP = 8;

/** "instruction A", for button labels. */
const label = (item: Item) =>
  `${kindName(item.kind).toLowerCase()} ${item.letter}`;

/** Same kind on the same page: the items one item can be reordered among. */
function pageSiblings(items: Item[], item: Item): Item[] {
  return items.filter(
    (other) =>
      other.kind === item.kind &&
      other.drawingId === item.drawingId &&
      other.page === item.page,
  );
}

/** Consecutive items on the same drawing page (items are in letter order). */
function pageGroups(items: Item[]) {
  const groups: {
    key: string;
    drawingId: string;
    page: number;
    items: Item[];
  }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.drawingId === item.drawingId && last.page === item.page)
      last.items.push(item);
    else
      groups.push({
        key: `${item.drawingId}:${item.page}`,
        drawingId: item.drawingId,
        page: item.page,
        items: [item],
      });
  }
  return groups;
}

interface Drag {
  id: string;
  pointerId: number;
  siblings: string[];
  /** Row boxes when the drag started (screen px). */
  rows: { top: number; height: number }[];
  startY: number;
  dy: number;
}

/** Where the dragged row would land, as an index among its siblings. */
function dropIndex(drag: Drag): number {
  const from = drag.siblings.indexOf(drag.id);
  const row = drag.rows[from];
  const mid = row.top + row.height / 2 + drag.dy;
  return drag.rows.filter(
    (other, i) => i !== from && other.top + other.height / 2 < mid,
  ).length;
}

/**
 * Every item in the inspection (observations, then instructions), inside the
 * drawings view. Swipe a row left for Delete (undoable); drag the handle to
 * reorder items of the same kind on the same page, which re-letters them.
 */
export function ItemsPanel({
  items,
  drawings,
  inView,
  onSelect,
  onClose,
}: Props) {
  const names = new Map(drawings.map((d) => [d.id, d.name]));
  const sorted = [...items].sort(compareItems);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const [openId, setOpenId] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);
  const press = useRef<{
    id: string;
    pointerId: number;
    x: number;
    y: number;
    base: number;
    /** Current offset (state can lag behind the last move). */
    dx: number;
    swiping: boolean;
  } | null>(null);
  /** A swipe just ended: swallow the click that follows it. */
  const swiped = useRef(false);
  const [drag, setDragState] = useState<Drag | null>(null);
  // Handlers read the ref: state can lag behind the last pointer move.
  const dragRef = useRef<Drag | null>(null);
  function setDrag(next: Drag | null) {
    dragRef.current = next;
    setDragState(next);
  }

  function offsetOf(id: string) {
    if (swipe?.id === id) return swipe.dx;
    return openId === id ? -REVEAL : 0;
  }

  // --- swipe to delete ----------------------------------------------------

  function onRowPointerDown(e: React.PointerEvent, item: Item) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    press.current = {
      id: item.id,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      base: openId === item.id ? -REVEAL : 0,
      dx: openId === item.id ? -REVEAL : 0,
      swiping: false,
    };
  }

  function onRowPointerMove(e: React.PointerEvent) {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.swiping) {
      if (Math.hypot(dx, dy) < SLOP) return;
      // Mostly vertical: leave it to the list's own scrolling.
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
    setSwipe({ id: p.id, dx: p.dx });
  }

  function onRowPointerUp(e: React.PointerEvent) {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    press.current = null;
    if (!p.swiping) return;
    swiped.current = true;
    setOpenId(p.dx < -REVEAL / 2 ? p.id : null);
    setSwipe(null);
  }

  function onRowClick(item: Item) {
    // A tap closes an open row instead of opening the item.
    if (openId) {
      setOpenId(null);
      return;
    }
    onSelect(item);
  }

  // --- drag to reorder ----------------------------------------------------

  function onHandlePointerDown(e: React.PointerEvent, item: Item) {
    e.stopPropagation();
    if (e.pointerType === "mouse") e.preventDefault();
    setOpenId(null);
    const siblings = pageSiblings(sorted, item).map((other) => other.id);
    const rows = siblings.map((id) => {
      const box = rowEls.current.get(id)!.getBoundingClientRect();
      return { top: box.top, height: box.height };
    });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already released.
    }
    setDrag({
      id: item.id,
      pointerId: e.pointerId,
      siblings,
      rows,
      startY: e.clientY,
      dy: 0,
    });
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const from = drag.siblings.indexOf(drag.id);
    const first = drag.rows[0];
    const last = drag.rows[drag.rows.length - 1];
    const row = drag.rows[from];
    // Stay within this page's rows.
    const dy = Math.min(
      last.top - row.top,
      Math.max(first.top - row.top, e.clientY - drag.startY),
    );
    setDrag({ ...drag, dy });
  }

  function onHandlePointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const from = drag.siblings.indexOf(drag.id);
    const to = dropIndex(drag);
    setDrag(null);
    if (e.type !== "pointerup" || to === from) return;
    const order = drag.siblings.filter((id) => id !== drag.id);
    order.splice(to, 0, drag.id);
    const inspectionId = sorted.find((i) => i.id === drag.id)?.inspectionId;
    if (inspectionId) void reorderItemsWithUndo(inspectionId, order);
  }

  /** How far a row moves while another is dragged past it. */
  function dragShift(id: string): number {
    if (!drag) return 0;
    if (id === drag.id) return drag.dy;
    const i = drag.siblings.indexOf(id);
    if (i < 0) return 0;
    const from = drag.siblings.indexOf(drag.id);
    const to = dropIndex(drag);
    const step =
      drag.rows.length > 1
        ? drag.rows[1].top - drag.rows[0].top
        : drag.rows[from].height;
    if (from < to && i > from && i <= to) return -step;
    if (from > to && i >= to && i < from) return step;
    return 0;
  }

  function renderRow(item: Item) {
    const offset = offsetOf(item.id);
    const canReorder = pageSiblings(sorted, item).length > 1;
    const dragged = drag?.id === item.id;
    return (
      <li
        key={item.id}
        className={[
          "swipe-row",
          dragged ? "swipe-row-dragged" : "",
          inView.has(item.id) ? "swipe-row-in-view" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid="items-panel-row"
        data-in-view={inView.has(item.id)}
        ref={(el) => {
          if (el) rowEls.current.set(item.id, el);
          else rowEls.current.delete(item.id);
        }}
        style={{
          transform: `translateY(${dragShift(item.id)}px)`,
          transition: dragged || !drag ? "none" : undefined,
        }}
      >
        <button
          type="button"
          className="swipe-delete"
          aria-label={`Delete ${label(item)}`}
          // Only reachable once the row is swiped open.
          aria-hidden={offset < 0 ? undefined : true}
          tabIndex={offset < 0 ? 0 : -1}
          onClick={() => {
            setOpenId(null);
            void deleteItemWithUndo(item);
          }}
        >
          Delete
        </button>
        <div
          className="swipe-content"
          style={{
            transform: `translateX(${offset}px)`,
            transition: swipe?.id === item.id ? "none" : undefined,
          }}
          onPointerDown={(e) => onRowPointerDown(e, item)}
          onPointerMove={onRowPointerMove}
          onPointerUp={onRowPointerUp}
          onPointerCancel={onRowPointerUp}
        >
          <button
            type="button"
            className="item-row"
            onClick={() => {
              // A swipe ends with a click; ignore it.
              if (swiped.current) {
                swiped.current = false;
                return;
              }
              onRowClick(item);
            }}
          >
            <span
              className={`item-badge${item.kind === "observation" ? " item-badge-observation" : ""}`}
              aria-hidden="true"
            >
              {item.letter}
            </span>
            <span className="item-row-text">
              <span>
                <strong>{item.letter}.</strong>{" "}
                {item.text.trim() || <span className="muted">No text yet</span>}
              </span>
            </span>
          </button>
          {canReorder && (
            <button
              type="button"
              className="drag-handle"
              aria-label={`Reorder ${label(item)}`}
              onPointerDown={(e) => onHandlePointerDown(e, item)}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
            >
              ≡
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <aside className="item-sheet" aria-label="Items" data-testid="items-panel">
      <div className="item-sheet-head">
        <h2>Items</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="muted">No items yet. Use Add pin.</p>
      ) : (
        <div className="item-groups">
          <p className="muted item-panel-hint">
            Swipe left to delete. Drag ≡ to reorder within a page.
          </p>
          {groupItems(sorted).map((group) => (
            <section key={group.kind} aria-label={group.heading}>
              <h3 className="item-group-heading">{group.heading}</h3>
              {pageGroups(group.items).map((pageGroup) => {
                const title = `${names.get(pageGroup.drawingId) ?? "Drawing"} · page ${pageGroup.page}`;
                return (
                  <div key={pageGroup.key} className="item-page-group">
                    <h4 className="item-page-heading">{title}</h4>
                    <ul
                      className="item-list"
                      aria-label={`${group.heading}, ${title}`}
                    >
                      {pageGroup.items.map(renderRow)}
                    </ul>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}
