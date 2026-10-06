/** Drawing and erasing marks, each one Undo step (SPEC section 5a). */
import { pushUndo } from "../../app/undo";
import { db } from "../../db/db";
import {
  addMarkup,
  deleteMarkups,
  restoreMarkups,
  setMarkupFill,
  updateMarkup,
  type NewMarkup,
} from "../../db/markups";
import type { Markup } from "../../db/types";

const LABELS: Record<Markup["tool"], string> = {
  pen: "Draw",
  highlighter: "Highlight",
  line: "Draw line",
  arrow: "Draw arrow",
  rect: "Draw rectangle",
  ellipse: "Draw ellipse",
  cloud: "Draw cloud",
  text: "Add text",
};

export async function drawWithUndo(mark: NewMarkup): Promise<Markup> {
  const record = await addMarkup(db, mark);
  pushUndo(mark.inspectionId, {
    label: LABELS[mark.tool],
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

/** The eraser tapped inside a filled shape: its fill comes off (undoable). */
export async function unfillWithUndo(mark: Markup): Promise<void> {
  await setMarkupFill(db, mark, false);
  pushUndo(mark.inspectionId, {
    label: "Remove fill",
    undo: () => setMarkupFill(db, mark, true),
    redo: () => setMarkupFill(db, mark, false),
  });
}

/** A callout typed again, moved or resized (undoable). */
export async function changeMarkWithUndo(
  mark: Markup,
  patch: Partial<Pick<Markup, "points" | "text" | "fixedWidth">>,
  label: string,
): Promise<void> {
  const before = {
    points: mark.points,
    text: mark.text,
    fixedWidth: mark.fixedWidth,
  };
  await updateMarkup(db, mark, patch);
  pushUndo(mark.inspectionId, {
    label,
    undo: () => updateMarkup(db, mark, before),
    redo: () => updateMarkup(db, mark, patch),
  });
}
