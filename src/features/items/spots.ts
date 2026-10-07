/**
 * An item's spots: its original pin and any copies (Copy pin; SPEC section
 * 5). Everything that draws pins, arrows or notes boxes works per spot;
 * letters and lists work per item. Pure.
 */
import type { Item, ItemArrow } from "../../db/types";

export interface PinSpot {
  /** The item id for the original pin, "itemId~copyId" for a copy. */
  key: string;
  itemId: string;
  /** Null for the original pin. */
  copyId: string | null;
  drawingId: string;
  page: number;
  x: number;
  y: number;
  arrows: ItemArrow[];
}

const SEPARATOR = "~";

export function spotKey(itemId: string, copyId: string | null): string {
  return copyId ? `${itemId}${SEPARATOR}${copyId}` : itemId;
}

export function parseSpotKey(key: string): {
  itemId: string;
  copyId: string | null;
} {
  const at = key.indexOf(SEPARATOR);
  return at < 0
    ? { itemId: key, copyId: null }
    : { itemId: key.slice(0, at), copyId: key.slice(at + 1) };
}

/**
 * The original pin first, then the copies in the order they were placed.
 * A general note has none.
 */
export function itemSpots(item: Item): PinSpot[] {
  if (item.general) return [];
  return [
    {
      key: item.id,
      itemId: item.id,
      copyId: null,
      drawingId: item.drawingId,
      page: item.page,
      x: item.x,
      y: item.y,
      arrows: item.arrows ?? [],
    },
    ...(item.copies ?? []).map((copy) => ({
      key: spotKey(item.id, copy.id),
      itemId: item.id,
      copyId: copy.id,
      drawingId: copy.drawingId,
      page: copy.page,
      x: copy.x,
      y: copy.y,
      arrows: copy.arrows ?? [],
    })),
  ];
}

/** Whether an item has a pin (original or copy) on a page. */
export function isOnPage(item: Item, drawingId: string, page: number): boolean {
  return itemSpots(item).some(
    (s) => s.drawingId === drawingId && s.page === page,
  );
}

/** How many spots an item is pinned at (1 without copies; 0 for a general note). */
export function spotCount(item: Item): number {
  if (item.general) return 0;
  return 1 + (item.copies?.length ?? 0);
}
