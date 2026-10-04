/**
 * Page management (the Pages view, SPEC section 5): hide, restore and
 * duplicate a drawing's pages. The PDF itself never changes; a drawing's
 * `pages` list says which PDF page each position shows and whether it is
 * hidden. Items and notes boxes refer to positions, so hiding moves
 * nothing, and duplicating moves the pins and boxes of later pages along.
 */
import { reletterInspection, touchInspection } from "./items";
import type { InspectionDb } from "./schema";
import type { Drawing, DrawingPage, Item } from "./types";

function pagesOf(drawing: Drawing): DrawingPage[] {
  return (
    drawing.pages ??
    Array.from({ length: drawing.pageCount }, (_, i) => ({ source: i + 1 }))
  );
}

/** Positions (1-based) on a drawing that have pins. */
export function markedPositions(drawingId: string, items: Item[]): Set<number> {
  return new Set(
    items.filter((item) => item.drawingId === drawingId).map((i) => i.page),
  );
}

/**
 * Hides (or restores) pages of one drawing. Pages with pins are never
 * hidden (their items must be removed first); returns how many changed.
 */
export async function setPagesHidden(
  db: InspectionDb,
  drawingId: string,
  positions: number[],
  hidden: boolean,
  now = Date.now(),
): Promise<number> {
  return db.transaction(
    "rw",
    [db.inspections, db.drawings, db.items],
    async () => {
      const drawing = await db.drawings.get(drawingId);
      if (!drawing) return 0;
      const items = await db.items
        .where("drawingId")
        .equals(drawingId)
        .toArray();
      const marked = markedPositions(drawingId, items);
      const pages = pagesOf(drawing).map((page) => ({ ...page }));
      let changed = 0;
      for (const position of positions) {
        const page = pages[position - 1];
        if (!page || Boolean(page.hidden) === hidden) continue;
        if (hidden && marked.has(position)) continue;
        if (hidden) page.hidden = true;
        else delete page.hidden;
        changed++;
      }
      if (changed) {
        await db.drawings.update(drawingId, { pages });
        await touchInspection(db, drawing.inspectionId, now);
      }
      return changed;
    },
  );
}

/**
 * Duplicates a page: a copy (of the same PDF page, without its pins) goes
 * right after it, and later pages' pins and notes boxes move along one.
 * Returns the copy's position.
 */
export async function duplicatePage(
  db: InspectionDb,
  drawingId: string,
  position: number,
  now = Date.now(),
): Promise<number> {
  return db.transaction(
    "rw",
    [db.inspections, db.drawings, db.items, db.observationBoxes],
    async () => {
      const drawing = await db.drawings.get(drawingId);
      if (!drawing) throw new Error(`Drawing ${drawingId} not found`);
      const pages = pagesOf(drawing);
      const original = pages[position - 1];
      if (!original) throw new Error(`No page ${position} on ${drawing.name}`);
      const next = [
        ...pages.slice(0, position),
        { source: original.source },
        ...pages.slice(position),
      ];
      await db.drawings.update(drawingId, { pages: next });
      await db.items
        .where("drawingId")
        .equals(drawingId)
        .filter((item) => item.page > position)
        .modify((item) => {
          item.page += 1;
        });
      await db.observationBoxes
        .filter((box) => box.drawingId === drawingId && box.page > position)
        .modify((box) => {
          box.page += 1;
        });
      await reletterInspection(db, drawing.inspectionId);
      await touchInspection(db, drawing.inspectionId, now);
      return position + 1;
    },
  );
}

/** How many visible pages across an inspection's drawings have no pins. */
export function countUnmarked(drawings: Drawing[], items: Item[]): number {
  let count = 0;
  for (const drawing of drawings) {
    const marked = markedPositions(drawing.id, items);
    pagesOf(drawing).forEach((page, i) => {
      if (!page.hidden && !marked.has(i + 1)) count++;
    });
  }
  return count;
}

/** Hides every visible page without pins in an inspection; returns how many. */
export async function hideUnmarkedPages(
  db: InspectionDb,
  inspectionId: string,
  now = Date.now(),
): Promise<number> {
  const drawings = await db.drawings
    .where("inspectionId")
    .equals(inspectionId)
    .toArray();
  let count = 0;
  for (const drawing of drawings) {
    const positions = pagesOf(drawing).map((_, i) => i + 1);
    count += await setPagesHidden(db, drawing.id, positions, true, now);
  }
  return count;
}
