/** Item actions that can be undone and redone (they record an undo entry). */
import { pushUndo } from "../../app/undo";
import { db } from "../../db/db";
import {
  createItem,
  deleteItem,
  reorderItems,
  restoreItem,
  type DeletedItem,
  type NewItem,
} from "../../db/items";
import type { Item } from "../../db/types";
import { kindName } from "./letters";

/** Places a new pin; Undo removes it (with anything typed since), Redo puts it back. */
export async function createItemWithUndo(
  item: NewItem,
  boxPosition: { x: number; y: number },
): Promise<Item> {
  const created = await createItem(db, item, boxPosition);
  let removed: DeletedItem | null = null;
  pushUndo(item.inspectionId, {
    label: `Add ${kindName(created.kind).toLowerCase()} ${created.letter}`,
    undo: async () => {
      removed = await deleteItem(db, created.id);
    },
    redo: async () => {
      if (removed) await restoreItem(db, removed);
    },
  });
  return created;
}

/** Deletes an item straight away (no confirm); Undo puts it back. */
export async function deleteItemWithUndo(item: Item): Promise<void> {
  let deleted = await deleteItem(db, item.id);
  if (!deleted) return;
  pushUndo(item.inspectionId, {
    label: `Delete ${kindName(item.kind).toLowerCase()} ${item.letter}`,
    undo: () => restoreItem(db, deleted!),
    redo: async () => {
      // Keep what this delete removed, for the next Undo.
      deleted = (await deleteItem(db, item.id)) ?? deleted;
    },
  });
}

/** Reorders items of one kind on one page (`ids` in the new order). */
export async function reorderItemsWithUndo(
  inspectionId: string,
  ids: string[],
): Promise<void> {
  const previous = await reorderItems(db, ids);
  pushUndo(inspectionId, {
    label: "Reorder items",
    undo: async () => {
      await reorderItems(db, previous);
    },
    redo: async () => {
      await reorderItems(db, ids);
    },
  });
}
