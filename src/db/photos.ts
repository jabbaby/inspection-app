import { compareItems } from "../features/items/letters";
import { touchInspection } from "./items";
import type { InspectionDb } from "./schema";
import { photoBlobIds, type Item, type Photo, type StoredBlob } from "./types";

/** A processed photo ready to store (see features/photos/processPhoto). */
export interface NewPhoto {
  /** The working copy (JPEG, about 1600 px long edge). */
  data: ArrayBuffer;
  type: string;
  width: number;
  height: number;
  takenAt: number;
  source: Photo["source"];
  /** The camera's full-size file, kept for saving at native resolution. */
  original?: { data: ArrayBuffer; type: string };
}

function blob(data: ArrayBuffer, type: string): StoredBlob {
  return { id: crypto.randomUUID(), data, type, size: data.byteLength };
}

/** Adds photos to the end of an item's photos. */
export async function addPhotos(
  db: InspectionDb,
  itemId: string,
  photos: NewPhoto[],
  now = Date.now(),
): Promise<Photo[]> {
  return db.transaction(
    "rw",
    [db.inspections, db.items, db.photos, db.blobs],
    async () => {
      const item = await db.items.get(itemId);
      if (!item) throw new Error(`Item ${itemId} not found`);
      const added: Photo[] = [];
      for (const p of photos) {
        const working = blob(p.data, p.type);
        const original = p.original && blob(p.original.data, p.original.type);
        await db.blobs.bulkAdd(original ? [working, original] : [working]);
        const photo: Photo = {
          id: crypto.randomUUID(),
          blobId: working.id,
          ...(original ? { originalBlobId: original.id } : {}),
          source: p.source,
          takenAt: p.takenAt,
          width: p.width,
          height: p.height,
        };
        await db.photos.add(photo);
        added.push(photo);
      }
      await db.items.update(itemId, {
        photoIds: [...item.photoIds, ...added.map((p) => p.id)],
      });
      await touchInspection(db, item.inspectionId, now);
      return added;
    },
  );
}

/** What deletePhoto removed, so restorePhoto can put it back exactly. */
export interface DeletedPhoto {
  itemId: string;
  photo: Photo;
  blobs: StoredBlob[];
  /** Its place among the item's photos. */
  index: number;
}

/** Deletes one photo (and its files) from an item. */
export async function deletePhoto(
  db: InspectionDb,
  itemId: string,
  photoId: string,
  now = Date.now(),
): Promise<DeletedPhoto | null> {
  return db.transaction(
    "rw",
    [db.inspections, db.items, db.photos, db.blobs],
    async () => {
      const [item, photo] = await Promise.all([
        db.items.get(itemId),
        db.photos.get(photoId),
      ]);
      if (!item || !photo) return null;
      const blobs = (await db.blobs.bulkGet(photoBlobIds(photo))).filter(
        (b) => b !== undefined,
      );
      await db.blobs.bulkDelete(photoBlobIds(photo));
      await db.photos.delete(photoId);
      await db.items.update(itemId, {
        photoIds: item.photoIds.filter((id) => id !== photoId),
      });
      await touchInspection(db, item.inspectionId, now);
      return { itemId, photo, blobs, index: item.photoIds.indexOf(photoId) };
    },
  );
}

/** Puts a deleted photo back (undo). Does nothing if its item is gone. */
export async function restorePhoto(
  db: InspectionDb,
  deleted: DeletedPhoto,
  now = Date.now(),
): Promise<void> {
  await db.transaction(
    "rw",
    [db.inspections, db.items, db.photos, db.blobs],
    async () => {
      const item = await db.items.get(deleted.itemId);
      if (!item) return;
      await db.blobs.bulkPut(deleted.blobs);
      await db.photos.put(deleted.photo);
      const ids = item.photoIds.filter((id) => id !== deleted.photo.id);
      ids.splice(Math.max(0, deleted.index), 0, deleted.photo.id);
      await db.items.update(item.id, { photoIds: ids });
      await touchInspection(db, item.inspectionId, now);
    },
  );
}

export async function setPhotoCaption(
  db: InspectionDb,
  photoId: string,
  caption: string,
  inspectionId: string,
  now = Date.now(),
): Promise<void> {
  await db.transaction("rw", [db.inspections, db.photos], async () => {
    await db.photos.update(photoId, { caption });
    await touchInspection(db, inspectionId, now);
  });
}

/** Records that photos were saved to the iPad (Share sheet completed). */
export async function markPhotosSaved(
  db: InspectionDb,
  photoIds: string[],
  at = Date.now(),
): Promise<void> {
  await db.transaction("rw", [db.photos], async () => {
    for (const id of photoIds) await db.photos.update(id, { savedAt: at });
  });
}

/**
 * Deletes the stored full-size originals of photos (the working copies
 * stay, for the report). Returns the bytes freed.
 */
export async function removeOriginals(
  db: InspectionDb,
  photoIds: string[],
): Promise<number> {
  return db.transaction("rw", [db.photos, db.blobs], async () => {
    let freed = 0;
    for (const photo of await db.photos.bulkGet(photoIds)) {
      if (!photo?.originalBlobId) continue;
      freed += (await db.blobs.get(photo.originalBlobId))?.size ?? 0;
      await db.blobs.delete(photo.originalBlobId);
      await db.photos.update(photo.id, { originalBlobId: undefined });
    }
    return freed;
  });
}

export interface InspectionPhoto {
  item: Item;
  photo: Photo;
  /** 1-based number among the item's photos. */
  number: number;
}

/** Every photo in an inspection, in item list order, then photo order. */
export async function listInspectionPhotos(
  db: InspectionDb,
  inspectionId: string,
): Promise<InspectionPhoto[]> {
  const items = (
    await db.items.where("inspectionId").equals(inspectionId).toArray()
  ).sort(compareItems);
  const photos = new Map(
    (await db.photos.bulkGet(items.flatMap((item) => item.photoIds)))
      .filter((p) => p !== undefined)
      .map((p) => [p.id, p]),
  );
  return items.flatMap((item) =>
    item.photoIds.flatMap((id, i) => {
      const photo = photos.get(id);
      return photo ? [{ item, photo, number: i + 1 }] : [];
    }),
  );
}
