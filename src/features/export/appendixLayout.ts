/**
 * The photo appendix's content and page layout (SPEC section 7; engineer
 * decisions 2026-10-02): A4 pages of 2 x 2 photos; groups for instructions
 * A, B ..., then observations A, B ..., then General; each group headed by
 * the item's label and text; photos labelled IA1, OA1 or G1. Pure.
 */
import type { Item, Photo } from "../../db/types";
import { indexForLetter, itemLabel } from "../items/letters";

export interface AppendixPhoto {
  photo: Photo;
  /** "Photo IA1", "Photo OB2", "Photo G1". */
  label: string;
}

export interface AppendixGroup {
  /** "Instruction A – Add N12 bar at grid C/4", or "General". */
  title: string;
  photos: AppendixPhoto[];
}

export interface AppendixRow {
  /** The group's title on its first row; "… (continued)" at the top of a later page. */
  heading: string | null;
  photos: AppendixPhoto[];
}

export interface AppendixPage {
  rows: AppendixRow[];
}

export const PHOTOS_PER_ROW = 2;
export const ROWS_PER_PAGE = 2;

/**
 * The appendix groups: items with photos (instructions, then
 * observations, each in letter order), then the general photos.
 */
export function appendixGroups(
  items: Item[],
  generalPhotoIds: string[],
  photos: Map<string, Photo>,
): AppendixGroup[] {
  const kindOrder = (item: Item) => (item.kind === "instruction" ? 0 : 1);
  const sorted = [...items].sort(
    (a, b) =>
      kindOrder(a) - kindOrder(b) ||
      indexForLetter(a.letter) - indexForLetter(b.letter),
  );
  const collect = (ids: string[], prefix: string): AppendixPhoto[] =>
    ids
      .map((id) => photos.get(id))
      .filter((p) => p !== undefined)
      .map((photo, i) => ({ photo, label: `Photo ${prefix}${i + 1}` }));
  const groups: AppendixGroup[] = sorted.flatMap((item) => {
    const prefix = `${item.kind === "instruction" ? "I" : "O"}${item.letter}`;
    const list = collect(item.photoIds, prefix);
    if (list.length === 0) return [];
    const text = item.text.trim();
    const label = itemLabel(item);
    return [{ title: text ? `${label} – ${text}` : label, photos: list }];
  });
  const general = collect(generalPhotoIds, "G");
  if (general.length > 0) groups.push({ title: "General", photos: general });
  return groups;
}

/**
 * Rows of two photos; each group starts a new row. Two rows per page; a
 * group carried onto a new page repeats its title with "(continued)".
 */
export function layoutAppendix(groups: AppendixGroup[]): AppendixPage[] {
  const pages: AppendixPage[] = [];
  let page: AppendixPage | null = null;
  for (const group of groups) {
    for (let i = 0; i < group.photos.length; i += PHOTOS_PER_ROW) {
      if (!page || page.rows.length === ROWS_PER_PAGE) {
        page = { rows: [] };
        pages.push(page);
      }
      const first = i === 0;
      page.rows.push({
        heading: first
          ? group.title
          : page.rows.length === 0
            ? `${group.title} (continued)`
            : null,
        photos: group.photos.slice(i, i + PHOTOS_PER_ROW),
      });
    }
  }
  return pages;
}

/** The size to draw a photo at: fitted inside the box, never cropped or enlarged past it. */
export function fitPhoto(
  photo: { width: number; height: number },
  box: { width: number; height: number },
): { width: number; height: number } {
  const scale = Math.min(box.width / photo.width, box.height / photo.height);
  return { width: photo.width * scale, height: photo.height * scale };
}
