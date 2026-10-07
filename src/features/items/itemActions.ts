/** Item actions that can be undone and redone (they record an undo entry). */
import { pushUndo, relabelUndo, type UndoEntry } from "../../app/undo";
import { db } from "../../db/db";
import {
  addCopy,
  createGeneralNote,
  createItem,
  deleteItem,
  removeCopy,
  removeOriginalSpot,
  reorderItems,
  restoreCopy,
  restoreItem,
  restoreOriginalSpot,
  updateCopy,
  updateItem,
  type DeletedItem,
  type NewItem,
  type RemovedCopy,
} from "../../db/items";
import type { Item, ItemArrow, ItemKind } from "../../db/types";
import { kindName } from "./letters";
import { itemSpots } from "./spots";

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

/** Adds a general note (no pin); Undo removes it, Redo puts it back. */
export async function createGeneralNoteWithUndo(
  inspectionId: string,
): Promise<Item> {
  const created = await createGeneralNote(db, inspectionId);
  let removed: DeletedItem | null = null;
  pushUndo(inspectionId, {
    label: `Add general note ${created.letter}`,
    undo: async () => {
      removed = await deleteItem(db, created.id);
    },
    redo: async () => {
      if (removed) await restoreItem(db, removed);
    },
  });
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
  /** Moves it too (the hold dragged the pin out from its arrowhead). */
  at?: { x: number; y: number },
): Promise<void> {
  await updateItem(db, created.id, {
    kind,
    ...(arrows && { arrows }),
    ...(at && { x: at.x, y: at.y }),
  });
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

/**
 * Sets the arrows of one of an item's pins (the original, or the copy
 * `copyId`): add, move or remove one; Undo restores the old set.
 */
export async function setArrowsWithUndo(
  item: Item,
  arrows: ItemArrow[],
  label: string,
  copyId: string | null = null,
): Promise<void> {
  const previous =
    itemSpots(item).find((s) => s.copyId === copyId)?.arrows ?? [];
  const write = (next: ItemArrow[]) =>
    copyId
      ? updateCopy(db, item.id, copyId, { arrows: next })
      : updateItem(db, item.id, { arrows: next });
  await write(arrows);
  // The item may be gone by the time these run (deleted since).
  const apply = (next: ItemArrow[]) => async () => {
    if (await db.items.get(item.id)) await write(next);
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

/** "3 items", for undo labels. */
const count = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

/** Deletes several items at once; one Undo brings them all back. */
export async function deleteItemsWithUndo(items: Item[]): Promise<void> {
  if (items.length === 0) return;
  let deleted: DeletedItem[] = [];
  for (const item of items) {
    const gone = await deleteItem(db, item.id);
    if (gone) deleted.push(gone);
  }
  if (deleted.length === 0) return;
  pushUndo(items[0].inspectionId, {
    label: `Delete ${count(deleted.length)}`,
    undo: async () => {
      for (const gone of deleted) await restoreItem(db, gone);
    },
    redo: async () => {
      const again: DeletedItem[] = [];
      for (const gone of deleted) {
        const removed = await deleteItem(db, gone.item.id);
        if (removed) again.push(removed);
      }
      deleted = again;
    },
  });
}

/**
 * Changes a field on several items at once (kind, photo confirmation);
 * one Undo puts every item's old value back.
 */
async function updateItemsWithUndo<
  K extends "kind" | "requiresPhotoConfirmation",
>(items: Item[], field: K, value: Item[K], label: string): Promise<void> {
  const changed = items.filter((item) => item[field] !== value);
  if (changed.length === 0) return;
  const apply = (pick: (item: Item) => Item[K]) => async () => {
    for (const item of changed)
      if (await db.items.get(item.id))
        await updateItem(db, item.id, { [field]: pick(item) });
  };
  await apply(() => value)();
  pushUndo(changed[0].inspectionId, {
    label,
    undo: apply((item) => item[field]),
    redo: apply(() => value),
  });
}

/** Makes several items instructions or observations (one Undo step). */
export function setKindsWithUndo(items: Item[], kind: ItemKind) {
  // General notes stay observations.
  items = items.filter((item) => !item.general);
  return updateItemsWithUndo(
    items,
    "kind",
    kind,
    `Make ${count(items.filter((i) => i.kind !== kind).length)} ${kindName(kind).toLowerCase()}s`,
  );
}

/** Turns photo confirmation on or off for several instructions (one Undo step). */
export function setPhotoConfirmationWithUndo(items: Item[], on: boolean) {
  const instructions = items.filter((i) => i.kind === "instruction");
  return updateItemsWithUndo(
    instructions,
    "requiresPhotoConfirmation",
    on,
    `Photo confirmation ${on ? "on" : "off"} for ${count(instructions.filter((i) => i.requiresPhotoConfirmation !== on).length)}`,
  );
}

/** Pins an item at another spot (Copy pin); Undo removes that copy. */
export async function addCopyWithUndo(
  item: Item,
  spot: { drawingId: string; page: number; x: number; y: number },
  boxPosition: { x: number; y: number },
): Promise<string> {
  const copy = await addCopy(db, item.id, spot, boxPosition);
  let removed: RemovedCopy | null = null;
  pushUndo(item.inspectionId, {
    label: `Copy ${kindName(item.kind).toLowerCase()} ${item.letter}`,
    undo: async () => {
      removed = await removeCopy(db, item.id, copy.id);
    },
    redo: async () => {
      if (removed) await restoreCopy(db, removed);
    },
  });
  return copy.id;
}

/**
 * Removes one of an item's pins, keeping the item: a copy, or the original
 * (the first copy then becomes the original, which may change letters).
 * Undo puts it back.
 */
export async function removeSpotWithUndo(
  item: Item,
  copyId: string | null,
): Promise<void> {
  const label = `Remove a pin of ${kindName(item.kind).toLowerCase()} ${item.letter}`;
  if (copyId) {
    let removed = await removeCopy(db, item.id, copyId);
    if (!removed) return;
    pushUndo(item.inspectionId, {
      label,
      undo: () => restoreCopy(db, removed!),
      redo: async () => {
        removed = (await removeCopy(db, item.id, copyId)) ?? removed;
      },
    });
    return;
  }
  let removed = await removeOriginalSpot(db, item.id);
  if (!removed) return;
  pushUndo(item.inspectionId, {
    label,
    undo: () => restoreOriginalSpot(db, removed!),
    redo: async () => {
      removed = (await removeOriginalSpot(db, item.id)) ?? removed;
    },
  });
}
