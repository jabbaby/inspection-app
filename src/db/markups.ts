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

export function listMarkups(
  db: InspectionDb,
  inspectionId: string,
): Promise<Markup[]> {
  return db.markups.where("inspectionId").equals(inspectionId).toArray();
}
