/** Photo actions that can be undone and redone (they record an undo entry). */
import { pushUndo } from "../../app/undo";
import { db } from "../../db/db";
import {
  addPhotos,
  deletePhoto,
  restorePhoto,
  type DeletedPhoto,
  type NewPhoto,
} from "../../db/photos";
import type { Item } from "../../db/types";
import { kindName } from "../items/letters";

const itemName = (item: Item) =>
  `${kindName(item.kind).toLowerCase()} ${item.letter}`;

export async function addPhotosWithUndo(
  item: Item,
  photos: NewPhoto[],
): Promise<void> {
  const added = await addPhotos(db, item.id, photos);
  let removed: DeletedPhoto[] = [];
  pushUndo(item.inspectionId, {
    label:
      added.length === 1
        ? `Add photo to ${itemName(item)}`
        : `Add ${added.length} photos to ${itemName(item)}`,
    undo: async () => {
      removed = [];
      // Newest first, so each comes back in its old place on redo.
      for (const photo of [...added].reverse()) {
        const d = await deletePhoto(db, item.id, photo.id);
        if (d) removed.unshift(d);
      }
    },
    redo: async () => {
      for (const d of removed) await restorePhoto(db, d);
    },
  });
}

export async function deletePhotoWithUndo(
  item: Item,
  photoId: string,
): Promise<void> {
  let deleted = await deletePhoto(db, item.id, photoId);
  if (!deleted) return;
  pushUndo(item.inspectionId, {
    label: `Delete photo from ${itemName(item)}`,
    undo: () => restorePhoto(db, deleted!),
    redo: async () => {
      deleted = (await deletePhoto(db, item.id, photoId)) ?? deleted;
    },
  });
}
