import type { Item } from "../../db/types";
import { itemLabel } from "../items/letters";
import { addPhotosWithUndo, deletePhotoWithUndo } from "./photoActions";
import { PhotoSet } from "./PhotoSet";

/**
 * An item's photos (adding and deleting are undoable). In its sheet the
 * set is headed "Photos"; elsewhere (`heading`) by the item, as in the
 * appendix, e.g. "Instruction A – Add N12 bar", and deleting asks first
 * (no Undo button there).
 */
export function ItemPhotos({
  item,
  heading = false,
  confirmDelete = false,
}: {
  item: Item;
  heading?: boolean;
  confirmDelete?: boolean;
}) {
  return (
    <PhotoSet
      photoIds={item.photoIds}
      inspectionId={item.inspectionId}
      item={item}
      title={itemLabel(item)}
      label={
        heading
          ? [itemLabel(item), item.text.trim()].filter(Boolean).join(" – ")
          : "Photos"
      }
      confirmDelete={confirmDelete}
      onAdd={(photos) => addPhotosWithUndo(item, photos)}
      onDelete={(photo) => void deletePhotoWithUndo(item, photo.id)}
    />
  );
}
