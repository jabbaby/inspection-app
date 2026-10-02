import { indexForLetter, letterForIndex } from "../features/items/letters";
import type { InspectionDb } from "./schema";
import { photoBlobIds } from "./types";
import type {
  Item,
  ItemKind,
  ObservationBox,
  Photo,
  StoredBlob,
} from "./types";

export interface NewItem {
  inspectionId: string;
  drawingId: string;
  page: number;
  x: number;
  y: number;
}

/** Fields the item sheet and pin dragging can change. */
export type ItemPatch = Partial<
  Pick<
    Item,
    "kind" | "text" | "requiresPhotoConfirmation" | "x" | "y" | "arrows"
  >
>;

/** Marks the inspection as changed (drives "Edited ..." on the list). */
export async function touchInspection(
  db: InspectionDb,
  inspectionId: string,
  now = Date.now(),
): Promise<void> {
  await db.inspections.update(inspectionId, { updatedAt: now });
}

/**
 * Creates an instruction item, lettered by its place in the document (which
 * may re-letter pins further on). The first pin on a page also creates that
 * page's notes box at `boxPosition`.
 */
export async function createItem(
  db: InspectionDb,
  item: NewItem,
  boxPosition: { x: number; y: number },
  now = Date.now(),
): Promise<Item> {
  return db.transaction(
    "rw",
    [db.inspections, db.drawings, db.items, db.observationBoxes],
    async () => {
      const inspection = await db.inspections.get(item.inspectionId);
      if (!inspection)
        throw new Error(`Inspection ${item.inspectionId} not found`);
      const existing = await db.items
        .where("inspectionId")
        .equals(item.inspectionId)
        .toArray();
      const created: Item = {
        id: crypto.randomUUID(),
        ...item,
        // Placeholder until re-lettered below.
        letter: letterForIndex(existing.length),
        kind: "instruction" satisfies ItemKind,
        text: "",
        requiresPhotoConfirmation: false,
        photoIds: [],
        // Strictly after every other item, so creation order never ties.
        createdAt: Math.max(
          now,
          ...existing.map((other) => other.createdAt + 1),
        ),
        sequence: 0,
        arrows: [],
      };
      // Placed last on its page.
      created.sequence = created.createdAt;
      await db.items.add(created);
      await reletterInspection(db, item.inspectionId);
      await touchInspection(db, item.inspectionId, now);
      const box = await db.observationBoxes
        .where("[drawingId+page]")
        .equals([item.drawingId, item.page])
        .first();
      if (!box) {
        await db.observationBoxes.add({
          id: crypto.randomUUID(),
          drawingId: item.drawingId,
          page: item.page,
          ...boxPosition,
        });
      }
      return (await db.items.get(created.id))!;
    },
  );
}

export async function updateItem(
  db: InspectionDb,
  id: string,
  patch: ItemPatch,
  now = Date.now(),
): Promise<void> {
  await db.transaction(
    "rw",
    [db.inspections, db.drawings, db.items],
    async () => {
      const item = await db.items.get(id);
      if (!item) throw new Error(`Item ${id} not found`);
      await db.items.update(id, patch);
      // Switching kind moves it to the other list: re-letter both.
      if (patch.kind && patch.kind !== item.kind)
        await reletterInspection(db, item.inspectionId);
      await touchInspection(db, item.inspectionId, now);
    },
  );
}

/** Deletes items with their photos and photo images (no transaction of its own). */
export async function deleteItemRecords(
  db: InspectionDb,
  items: Item[],
): Promise<void> {
  const photoIds = items.flatMap((item) => item.photoIds);
  const photos = (await db.photos.bulkGet(photoIds)).filter(
    (p) => p !== undefined,
  );
  await db.blobs.bulkDelete(photos.flatMap(photoBlobIds));
  await db.photos.bulkDelete(photoIds);
  await db.items.bulkDelete(items.map((item) => item.id));
}

/**
 * Letters for items, per kind: instructions A, B, C... and observations
 * A, B, C... each in document order (drawing order, then page, then the
 * item's sequence on the page: placement order unless reordered), with no
 * gaps. `drawingOrder` lists
 * the inspection's drawing ids in document order. Returns only the items
 * whose letter changes.
 */
export function letterChanges(
  items: Item[],
  drawingOrder: string[],
): { id: string; letter: string }[] {
  const rank = new Map(drawingOrder.map((id, i) => [id, i]));
  const drawingRank = (item: Item) => rank.get(item.drawingId) ?? Infinity;
  const changes: { id: string; letter: string }[] = [];
  for (const kind of ["instruction", "observation"] as const) {
    const ofKind = items
      .filter((item) => item.kind === kind)
      .sort(
        (a, b) =>
          drawingRank(a) - drawingRank(b) ||
          a.page - b.page ||
          a.sequence - b.sequence ||
          indexForLetter(a.letter) - indexForLetter(b.letter),
      );
    for (const [index, item] of ofKind.entries()) {
      const letter = letterForIndex(index);
      if (item.letter !== letter) changes.push({ id: item.id, letter });
    }
  }
  return changes;
}

/**
 * Re-letters an inspection's items (see letterChanges). Run inside a
 * transaction that includes drawings and items.
 */
export async function reletterInspection(
  db: InspectionDb,
  inspectionId: string,
): Promise<void> {
  const [items, drawings] = await Promise.all([
    db.items.where("inspectionId").equals(inspectionId).toArray(),
    db.drawings.where("inspectionId").equals(inspectionId).toArray(),
  ]);
  drawings.sort((a, b) => a.createdAt - b.createdAt);
  const order = drawings.map((d) => d.id);
  for (const { id, letter } of letterChanges(items, order))
    await db.items.update(id, { letter });
}

/** Everything deleteItem removed, so restoreItem can put it back exactly. */
export interface DeletedItem {
  item: Item;
  photos: Photo[];
  blobs: StoredBlob[];
  /** The page's notes box, if the item was its last pin. */
  box: ObservationBox | null;
}

/**
 * Deletes an item and its photos, then re-letters the rest so there are no
 * gaps (delete C and D becomes C). The page's notes box goes when its last
 * pin does. Returns what was removed (for undo), or null if not found.
 */
export async function deleteItem(
  db: InspectionDb,
  id: string,
  now = Date.now(),
): Promise<DeletedItem | null> {
  return db.transaction(
    "rw",
    [
      db.inspections,
      db.drawings,
      db.items,
      db.photos,
      db.blobs,
      db.observationBoxes,
    ],
    async () => {
      const item = await db.items.get(id);
      if (!item) return null;
      const photos = (await db.photos.bulkGet(item.photoIds)).filter(
        (p) => p !== undefined,
      );
      const blobs = (
        await db.blobs.bulkGet(photos.flatMap(photoBlobIds))
      ).filter((b) => b !== undefined);
      await deleteItemRecords(db, [item]);
      const remaining = await db.items
        .where("drawingId")
        .equals(item.drawingId)
        .filter((other) => other.page === item.page)
        .count();
      let box: ObservationBox | null = null;
      if (remaining === 0) {
        const pageBox = db.observationBoxes
          .where("[drawingId+page]")
          .equals([item.drawingId, item.page]);
        box = (await pageBox.first()) ?? null;
        await pageBox.delete();
      }
      await reletterInspection(db, item.inspectionId);
      await touchInspection(db, item.inspectionId, now);
      return { item, photos, blobs, box };
    },
  );
}

/**
 * Puts a deleted item back (undo) with its photos and notes box, then
 * re-letters. Does nothing if its drawing has since been deleted.
 */
export async function restoreItem(
  db: InspectionDb,
  deleted: DeletedItem,
  now = Date.now(),
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.inspections,
      db.drawings,
      db.items,
      db.photos,
      db.blobs,
      db.observationBoxes,
    ],
    async () => {
      const { item } = deleted;
      if (!(await db.drawings.get(item.drawingId))) return;
      await db.blobs.bulkPut(deleted.blobs);
      await db.photos.bulkPut(deleted.photos);
      await db.items.put(item);
      const box = await db.observationBoxes
        .where("[drawingId+page]")
        .equals([item.drawingId, item.page])
        .first();
      if (!box && deleted.box) await db.observationBoxes.put(deleted.box);
      await reletterInspection(db, item.inspectionId);
      await touchInspection(db, item.inspectionId, now);
    },
  );
}

/**
 * Reorders items of one kind on one page: `ids` in their new order. Their
 * sequence numbers are shared out again in that order, then everything is
 * re-lettered. Returns the previous order (for undo).
 */
export async function reorderItems(
  db: InspectionDb,
  ids: string[],
  now = Date.now(),
): Promise<string[]> {
  return db.transaction(
    "rw",
    [db.inspections, db.drawings, db.items],
    async () => {
      const items = (await db.items.bulkGet(ids)).filter(
        (item) => item !== undefined,
      );
      const previous = [...items].sort((a, b) => a.sequence - b.sequence);
      if (items.length < 2) return previous.map((item) => item.id);
      const [first] = items;
      const samePage = items.every(
        (item) =>
          item.inspectionId === first.inspectionId &&
          item.kind === first.kind &&
          item.drawingId === first.drawingId &&
          item.page === first.page,
      );
      if (!samePage)
        throw new Error("Only items of one kind on one page can be reordered");
      const slots = previous.map((item) => item.sequence);
      const present = ids.filter((id) => items.some((item) => item.id === id));
      for (const [i, id] of present.entries())
        await db.items.update(id, { sequence: slots[i] });
      await reletterInspection(db, first.inspectionId);
      await touchInspection(db, first.inspectionId, now);
      return previous.map((item) => item.id);
    },
  );
}

export async function moveObservationBox(
  db: InspectionDb,
  id: string,
  to: { x: number; y: number },
  inspectionId: string,
  now = Date.now(),
): Promise<void> {
  await db.transaction(
    "rw",
    [db.inspections, db.observationBoxes],
    async () => {
      await db.observationBoxes.update(id, to);
      await touchInspection(db, inspectionId, now);
    },
  );
}
