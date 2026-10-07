/** Drawing and erasing marks, each one Undo step (SPEC section 5a). */
import { pushUndo } from "../../app/undo";
import { db } from "../../db/db";
import {
  addMarkup,
  addMarkups,
  deleteMarkups,
  restoreMarkups,
  setMarkupFill,
  updateMarkup,
  updateMarkups,
  type MarkupPatch,
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
  polygon: "Draw shape",
  oval: "Draw ellipse",
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
  label = marks.length === 1 ? "Erase" : `Erase ${marks.length} marks`,
): Promise<void> {
  if (marks.length === 0) return;
  await deleteMarkups(
    db,
    inspectionId,
    marks.map((m) => m.id),
  );
  pushUndo(inspectionId, {
    label,
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

/**
 * Several marks changed at once (a selection moved, resized, recoloured or
 * given a new weight): one Undo step.
 */
export async function changeMarksWithUndo(
  marks: Markup[],
  patchOf: (mark: Markup) => MarkupPatch,
  label: string,
): Promise<void> {
  if (marks.length === 0) return;
  const inspectionId = marks[0].inspectionId;
  const after = marks.map((m) => ({ id: m.id, patch: patchOf(m) }));
  const before = marks.map((m, i) => ({
    id: m.id,
    patch: Object.fromEntries(
      Object.keys(after[i].patch).map((k) => [k, m[k as keyof MarkupPatch]]),
    ) as MarkupPatch,
  }));
  await updateMarkups(db, inspectionId, after);
  pushUndo(inspectionId, {
    label,
    undo: () => updateMarkups(db, inspectionId, before),
    redo: () => updateMarkups(db, inspectionId, after),
  });
}

/** Copies of marks, each moved by (dx, dy) normalised: one Undo step. */
export async function duplicateWithUndo(
  marks: Markup[],
  movedOf: (mark: Markup) => number[],
): Promise<Markup[]> {
  if (marks.length === 0) return [];
  const inspectionId = marks[0].inspectionId;
  const records = await addMarkups(
    db,
    marks.map((m) => {
      const copy: NewMarkup & { id?: string; createdAt?: number } = {
        ...m,
        points: movedOf(m),
      };
      delete copy.id;
      delete copy.createdAt;
      return copy;
    }),
  );
  pushUndo(inspectionId, {
    label:
      records.length === 1 ? "Duplicate" : `Duplicate ${records.length} marks`,
    undo: () =>
      deleteMarkups(
        db,
        inspectionId,
        records.map((r) => r.id),
      ),
    redo: () => restoreMarkups(db, records),
  });
  return records;
}
