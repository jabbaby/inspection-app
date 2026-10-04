/** Item actions that can be undone and redone (they record an undo entry). */
import { pushUndo, relabelUndo, type UndoEntry } from "../../app/undo";
import { db } from "../../db/db";
import {
  createItem,
  deleteItem,
  reorderItems,
  restoreItem,
  updateItem,
  type DeletedItem,
  type NewItem,
} from "../../db/items";
import type { Item, ItemArrow, ItemKind } from "../../db/types";
import { kindName } from "./letters";

/** Places a new pin; Undo removes it (with anything typed since), Redo puts it back. */
export async function createItemWithUndo(
  item: NewItem,
  boxPosition: { x: number; y: number },
): Promise<Item> {
  const created = await createItem(db, item, boxPosition);
  let removed: DeletedItem | null = null;
  const entry: UndoEntry = {
    label: `Add ${kindName(created.kind).toLowerCase()} ${created.letter}`,
    undo: async () => {
      removed = await deleteItem(db, created.id);
    },
    redo: async () => {
      if (removed) await restoreItem(db, removed);
    },
  };
  addEntries.set(created.id, entry);
  pushUndo(item.inspectionId, entry);
  return created;
}

/** Each placed pin's "Add" undo entry, so a double-tap can fold into it. */
const addEntries = new Map<string, UndoEntry>();

/**
 * Switches the kind of a pin placed a moment ago (the second tap of a
 * double-tap) as part of its "Add" step: one Undo removes the pin.
 */
export async function switchNewItemKind(
  created: Item,
  kind: ItemKind,
  /** Replaces its arrows too (a double-tap and hold drags one out). */
  arrows?: ItemArrow[],
): Promise<void> {
  await updateItem(db, created.id, arrows ? { kind, arrows } : { kind });
  const entry = addEntries.get(created.id);
  const item = await db.items.get(created.id);
  if (entry && item)
    relabelUndo(entry, `Add ${kindName(kind).toLowerCase()} ${item.letter}`);
}

/** Switches an item between instruction and observation; Undo switches back. */
export async function setKindWithUndo(
  item: Item,
  kind: ItemKind,
): Promise<void> {
  if (item.kind === kind) return;
  await updateItem(db, item.id, { kind });
  const apply = (next: ItemKind) => async () => {
    if (await db.items.get(item.id))
      await updateItem(db, item.id, { kind: next });
  };
  pushUndo(item.inspectionId, {
    label: `Switch ${kindName(item.kind).toLowerCase()} ${item.letter} to ${kindName(kind).toLowerCase()}`,
    undo: apply(item.kind),
    redo: apply(kind),
  });
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

/** Sets an item's arrows (add, move or remove one); Undo restores the old set. */
export async function setArrowsWithUndo(
  item: Item,
  arrows: ItemArrow[],
  label: string,
): Promise<void> {
  const previous = item.arrows ?? [];
  await updateItem(db, item.id, { arrows });
  // The item may be gone by the time these run (deleted since).
  const apply = (next: ItemArrow[]) => async () => {
    if (await db.items.get(item.id))
      await updateItem(db, item.id, { arrows: next });
  };
  pushUndo(item.inspectionId, {
    label,
    undo: apply(previous),
    redo: apply(arrows),
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
