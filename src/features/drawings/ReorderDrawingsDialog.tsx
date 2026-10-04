import { useEffect, useId, useRef } from "react";
import { useRowDrag } from "../../app/useRowDrag";
import { db } from "../../db/db";
import { reorderDrawings } from "../../db/drawings";
import type { Drawing } from "../../db/types";
import { drawingPages } from "./document/documentLayout";

/**
 * From the Pages view: the drawings in document order; drag a ≡ handle to
 * move one. Each move is saved at once (letters follow); Done closes.
 */
export function ReorderDrawingsDialog({
  open,
  inspectionId,
  drawings,
  onClose,
}: {
  open: boolean;
  inspectionId: string;
  /** In document order. */
  drawings: Drawing[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reorder = useRowDrag(
    drawings.map((d) => d.id),
    (order) => void reorderDrawings(db, inspectionId, order),
  );

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog wide"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId}>Reorder drawings</h2>
      <p className="muted">
        Drag ≡ to move a drawing. Pages, page numbers and letters follow the new
        order.
      </p>
      <ul className="list-panel" aria-label="Drawing order">
        {drawings.map((drawing) => {
          const shown = drawingPages(drawing).filter((p) => !p.hidden).length;
          const dragged = reorder.draggingId === drawing.id;
          return (
            <li
              key={drawing.id}
              ref={reorder.rowRef(drawing.id)}
              className={`list-row reorder-row${dragged ? " reorder-row-dragged" : ""}`}
              style={{
                transform: `translateY(${reorder.shift(drawing.id)}px)`,
                transition:
                  reorder.draggingId === null || dragged ? "none" : undefined,
              }}
            >
              <button
                type="button"
                className="drag-handle"
                aria-label={`Reorder ${drawing.name}`}
                {...reorder.handleProps(drawing.id)}
              >
                ≡
              </button>
              <span className="list-row-main">
                <span className="list-row-title">{drawing.name}</span>
                <span className="list-row-meta">
                  {shown} {shown === 1 ? "page" : "pages"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="button-row dialog-actions">
        {/* Focus starts here, not on the first handle. */}
        <button type="button" className="emphasis" autoFocus onClick={onClose}>
          Done
        </button>
      </p>
    </dialog>
  );
}
