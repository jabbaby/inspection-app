import { letterForIndex } from "../features/items/letters";
import type { InspectionDb } from "./schema";
import type { Item, ItemKind } from "./types";

export interface NewItem {
  inspectionId: string;
  drawingId: string;
  page: number;
  x: number;
  y: number;
}

/** Fields the item sheet and pin dragging can change. */
export type ItemPatch = Partial<
  Pick<Item, "kind" | "text" | "requiresPhotoConfirmation" | "x" | "y">
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
 * Creates an instruction item with the inspection's next letter (the counter
 * only ever increases, so letters are never reused). The first pin on a page
 * also creates that page's observations box at `boxPosition`.
 */
export async function createItem(
  db: InspectionDb,
  item: NewItem,
  boxPosition: { x: number; y: number },
  now = Date.now(),
): Promise<Item> {
  return db.transaction(
    "rw",
    [db.inspections, db.items, db.observationBoxes],
    async () => {
      const inspection = await db.inspections.get(item.inspectionId);
      if (!inspection)
        throw new Error(`Inspection ${item.inspectionId} not found`);
      const index = inspection.nextLetterIndex ?? 0;
      const created: Item = {
        id: crypto.randomUUID(),
        ...item,
        letter: letterForIndex(index),
        kind: "instruction" satisfies ItemKind,
        text: "",
        requiresPhotoConfirmation: false,
        photoIds: [],
        createdAt: now,
      };
      await db.items.add(created);
      await db.inspections.update(item.inspectionId, {
        nextLetterIndex: index + 1,
        updatedAt: now,
      });
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
      return created;
    },
  );
}

export async function updateItem(
  db: InspectionDb,
  id: string,
  patch: ItemPatch,
  now = Date.now(),
): Promise<void> {
  await db.transaction("rw", [db.inspections, db.items], async () => {
    const item = await db.items.get(id);
    if (!item) throw new Error(`Item ${id} not found`);
    await db.items.update(id, patch);
    await touchInspection(db, item.inspectionId, now);
  });
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
  await db.blobs.bulkDelete(photos.map((p) => p.blobId));
  await db.photos.bulkDelete(photoIds);
  await db.items.bulkDelete(items.map((item) => item.id));
}

/**
 * Deletes an item and its photos. Its letter is not reused. The page's
 * observations box goes when its last pin does.
 */
export async function deleteItem(
  db: InspectionDb,
  id: string,
  now = Date.now(),
): Promise<void> {
  await db.transaction(
    "rw",
    [db.inspections, db.items, db.photos, db.blobs, db.observationBoxes],
    async () => {
      const item = await db.items.get(id);
      if (!item) return;
      await deleteItemRecords(db, [item]);
      const remaining = await db.items
        .where("drawingId")
        .equals(item.drawingId)
        .filter((other) => other.page === item.page)
        .count();
      if (remaining === 0) {
        await db.observationBoxes
          .where("[drawingId+page]")
          .equals([item.drawingId, item.page])
          .delete();
      }
      await touchInspection(db, item.inspectionId, now);
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
