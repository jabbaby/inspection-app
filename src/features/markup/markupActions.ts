/** Drawing and erasing marks, each one Undo step (SPEC section 5a). */
import { pushUndo } from "../../app/undo";
import { db } from "../../db/db";
import {
  addMarkup,
  deleteMarkups,
  restoreMarkups,
  type NewMarkup,
} from "../../db/markups";
import type { Markup } from "../../db/types";

export async function drawWithUndo(mark: NewMarkup): Promise<Markup> {
  const record = await addMarkup(db, mark);
  pushUndo(mark.inspectionId, {
    label: mark.tool === "highlighter" ? "Highlight" : "Draw",
    undo: () => deleteMarkups(db, mark.inspectionId, [record.id]),
    redo: () => restoreMarkups(db, [record]),
  });
  return record;
}

export async function eraseWithUndo(
  inspectionId: string,
  marks: Markup[],
): Promise<void> {
  if (marks.length === 0) return;
  await deleteMarkups(
    db,
    inspectionId,
    marks.map((m) => m.id),
  );
  pushUndo(inspectionId, {
    label: marks.length === 1 ? "Erase" : `Erase ${marks.length} marks`,
    undo: () => restoreMarkups(db, marks),
    redo: () =>
      deleteMarkups(
        db,
        inspectionId,
        marks.map((m) => m.id),
      ),
  });
}
