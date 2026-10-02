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

/**
 * Whose photo list a photo is in: an item's, or the inspection's own
 * general photos (not tied to a pin; the appendix's General group).
 */
export type PhotoOwner = { itemId: string } | { inspectionId: string };

function blob(data: ArrayBuffer, type: string): StoredBlob {
  return { id: crypto.randomUUID(), data, type, size: data.byteLength };
}

/** The owner's photo ids and inspection, or null if it's gone. */
async function ownerPhotos(
  db: InspectionDb,
  owner: PhotoOwner,
): Promise<{ ids: string[]; inspectionId: string } | null> {
  if ("itemId" in owner) {
    const item = await db.items.get(owner.itemId);
    return item
      ? { ids: item.photoIds, inspectionId: item.inspectionId }
      : null;
  }
  const inspection = await db.inspections.get(owner.inspectionId);
  return inspection
    ? { ids: inspection.photoIds ?? [], inspectionId: inspection.id }
    : null;
}

async function setOwnerPhotos(
  db: InspectionDb,
  owner: PhotoOwner,
  ids: string[],
): Promise<void> {
  if ("itemId" in owner) await db.items.update(owner.itemId, { photoIds: ids });
  else await db.inspections.update(owner.inspectionId, { photoIds: ids });
}

/** Adds photos to the end of an item's (or the inspection's) photos. */
export async function addPhotos(
  db: InspectionDb,
  owner: PhotoOwner,
  photos: NewPhoto[],
  now = Date.now(),
): Promise<Photo[]> {
  return db.transaction(
    "rw",
    [db.inspections, db.items, db.photos, db.blobs],
    async () => {
      const list = await ownerPhotos(db, owner);
      if (!list) throw new Error("Photo owner not found");
      const added: Photo[] = [];
      for (const p of photos) {
        const working = blob(p.data, p.type);
        const original = p.original && blob(p.original.data, p.original.type);
        await db.blobs.bulkAdd(original ? [working, original] : [working]);
        const photo: Photo = {
          id: crypto.randomUUID(),
          blobId: working.id,
          ...(original
            ? { originalBlobId: original.id, originalSize: original.size }
            : {}),
          source: p.source,
          takenAt: p.takenAt,
          width: p.width,
          height: p.height,
        };
        await db.photos.add(photo);
        added.push(photo);
      }
      await setOwnerPhotos(db, owner, [...list.ids, ...added.map((p) => p.id)]);
      await touchInspection(db, list.inspectionId, now);
      return added;
    },
  );
}

/** What deletePhoto removed, so restorePhoto can put it back exactly. */
export interface DeletedPhoto {
  owner: PhotoOwner;
  photo: Photo;
  blobs: StoredBlob[];
  /** Its place among the owner's photos. */
  index: number;
}

/** Deletes one photo (and its files). */
export async function deletePhoto(
  db: InspectionDb,
  owner: PhotoOwner,
  photoId: string,
  now = Date.now(),
): Promise<DeletedPhoto | null> {
  return db.transaction(
    "rw",
    [db.inspections, db.items, db.photos, db.blobs],
    async () => {
      const [list, photo] = await Promise.all([
        ownerPhotos(db, owner),
        db.photos.get(photoId),
      ]);
      if (!list || !photo) return null;
      const blobs = (await db.blobs.bulkGet(photoBlobIds(photo))).filter(
        (b) => b !== undefined,
      );
      await db.blobs.bulkDelete(photoBlobIds(photo));
      await db.photos.delete(photoId);
      await setOwnerPhotos(
        db,
        owner,
        list.ids.filter((id) => id !== photoId),
      );
      await touchInspection(db, list.inspectionId, now);
      return { owner, photo, blobs, index: list.ids.indexOf(photoId) };
    },
  );
}

/** Puts a deleted photo back (undo). Does nothing if its owner is gone. */
export async function restorePhoto(
  db: InspectionDb,
  deleted: DeletedPhoto,
  now = Date.now(),
): Promise<void> {
  await db.transaction(
    "rw",
    [db.inspections, db.items, db.photos, db.blobs],
    async () => {
      const list = await ownerPhotos(db, deleted.owner);
      if (!list) return;
      await db.blobs.bulkPut(deleted.blobs);
      await db.photos.put(deleted.photo);
      const ids = list.ids.filter((id) => id !== deleted.photo.id);
      ids.splice(Math.max(0, deleted.index), 0, deleted.photo.id);
      await setOwnerPhotos(db, deleted.owner, ids);
      await touchInspection(db, list.inspectionId, now);
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
      freed += photo.originalSize ?? 0;
      await db.blobs.delete(photo.originalBlobId);
      await db.photos.update(photo.id, {
        originalBlobId: undefined,
        originalSize: undefined,
      });
    }
    return freed;
  });
}

export interface InspectionPhoto {
  /** The photo's item, or null for a general photo. */
  item: Item | null;
  photo: Photo;
  /** 1-based number among its item's (or the general) photos. */
  number: number;
}

/**
 * Every photo in an inspection: item photos in item list order, then the
 * general photos, each in their own order.
 */
export async function listInspectionPhotos(
  db: InspectionDb,
  inspectionId: string,
): Promise<InspectionPhoto[]> {
  const [items, inspection] = await Promise.all([
    db.items.where("inspectionId").equals(inspectionId).toArray(),
    db.inspections.get(inspectionId),
  ]);
  items.sort(compareItems);
  const general = inspection?.photoIds ?? [];
  const photos = new Map(
    (
      await db.photos.bulkGet([
        ...items.flatMap((item) => item.photoIds),
        ...general,
      ])
    )
      .filter((p) => p !== undefined)
      .map((p) => [p.id, p]),
  );
  const entries = (item: Item | null, ids: string[]) =>
    ids.flatMap((id, i) => {
      const photo = photos.get(id);
      return photo ? [{ item, photo, number: i + 1 }] : [];
    });
  return [
    ...items.flatMap((item) => entries(item, item.photoIds)),
    ...entries(null, general),
  ];
}
