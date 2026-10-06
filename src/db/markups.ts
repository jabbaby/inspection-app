/**
 * Markup records (SPEC section 5a): one per mark on a drawing page. Marks
 * refer to page positions like items do, so page operations move them
 * along (pages.ts) and deleting a drawing or inspection removes them.
 */
import { touchInspection } from "./items";
import type { InspectionDb } from "./schema";
import type { Markup } from "./types";

export type NewMarkup = Omit<Markup, "id" | "createdAt">;

export async function addMarkup(
  db: InspectionDb,
  mark: NewMarkup,
  now = Date.now(),
): Promise<Markup> {
  const record: Markup = { ...mark, id: crypto.randomUUID(), createdAt: now };
  await db.transaction("rw", [db.inspections, db.markups], async () => {
    await db.markups.add(record);
    await touchInspection(db, mark.inspectionId, now);
  });
  return record;
}

/** Puts marks back exactly as they were (undo of an erase, redo of a draw). */
export async function restoreMarkups(
  db: InspectionDb,
  marks: Markup[],
  now = Date.now(),
): Promise<void> {
  if (marks.length === 0) return;
  await db.transaction("rw", [db.inspections, db.markups], async () => {
    await db.markups.bulkPut(marks);
    await touchInspection(db, marks[0].inspectionId, now);
  });
}

export async function deleteMarkups(
  db: InspectionDb,
  inspectionId: string,
  ids: string[],
  now = Date.now(),
): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction("rw", [db.inspections, db.markups], async () => {
    await db.markups.bulkDelete(ids);
    await touchInspection(db, inspectionId, now);
  });
}

/** What can change on a saved mark. */
export type MarkupPatch = Partial<
  Pick<Markup, "points" | "text" | "fixedWidth" | "colour" | "weight">
>;

/** Adds several marks in one go (a duplicated selection). */
export async function addMarkups(
  db: InspectionDb,
  marks: NewMarkup[],
  now = Date.now(),
): Promise<Markup[]> {
  const records: Markup[] = marks.map((mark) => ({
    ...mark,
    id: crypto.randomUUID(),
    createdAt: now,
  }));
  if (records.length === 0) return records;
  await db.transaction("rw", [db.inspections, db.markups], async () => {
    await db.markups.bulkAdd(records);
    await touchInspection(db, records[0].inspectionId, now);
  });
  return records;
}

/** Changes several marks in one go (a selection moved or restyled). */
export async function updateMarkups(
  db: InspectionDb,
  inspectionId: string,
  changes: { id: string; patch: MarkupPatch }[],
  now = Date.now(),
): Promise<void> {
  if (changes.length === 0) return;
  await db.transaction("rw", [db.inspections, db.markups], async () => {
    for (const { id, patch } of changes) await db.markups.update(id, patch);
    await touchInspection(db, inspectionId, now);
  });
}

/** Changes a mark's points or text (a callout typed again, moved or resized). */
export async function updateMarkup(
  db: InspectionDb,
  mark: Pick<Markup, "id" | "inspectionId">,
  patch: MarkupPatch,
  now = Date.now(),
): Promise<void> {
  await db.transaction("rw", [db.inspections, db.markups], async () => {
    await db.markups.update(mark.id, patch);
    await touchInspection(db, mark.inspectionId, now);
  });
}

/** Takes a closed shape's fill off (or puts it back). */
export async function setMarkupFill(
  db: InspectionDb,
  mark: Pick<Markup, "id" | "inspectionId">,
  fill: boolean,
  now = Date.now(),
): Promise<void> {
  await db.transaction("rw", [db.inspections, db.markups], async () => {
    await db.markups.update(mark.id, { fill });
    await touchInspection(db, mark.inspectionId, now);
  });
}

export function listMarkups(
  db: InspectionDb,
  inspectionId: string,
): Promise<Markup[]> {
  return db.markups.where("inspectionId").equals(inspectionId).toArray();
}
