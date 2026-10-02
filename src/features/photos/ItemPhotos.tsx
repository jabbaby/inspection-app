import type { Item } from "../../db/types";
import { itemLabel } from "../items/letters";
import { addPhotosWithUndo, deletePhotoWithUndo } from "./photoActions";
import { PhotoSet } from "./PhotoSet";

/** An item's photos in its sheet (adding and deleting are undoable). */
export function ItemPhotos({ item }: { item: Item }) {
  return (
    <PhotoSet
      photoIds={item.photoIds}
      inspectionId={item.inspectionId}
      item={item}
      title={itemLabel(item)}
      label="Photos"
      onAdd={(photos) => addPhotosWithUndo(item, photos)}
      onDelete={(photo) => void deletePhotoWithUndo(item, photo.id)}
    />
  );
}
