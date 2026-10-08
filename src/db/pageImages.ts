/**
 * Saved page images (step 10b): each drawing page's base image, kept as a
 * lossless PNG so it shows at once next time instead of being drawn from
 * the PDF again. See PageImage in types.ts.
 */
import type { InspectionDb } from "./schema";
import type { PageImage } from "./types";

/** The saved image's id for a page shown at a size. */
export function pageImageId(
  drawingId: string,
  source: number,
  width: number,
  height: number,
): string {
  return `${drawingId}:${source}:${width}x${height}`;
}

export async function savePageImage(
  db: InspectionDb,
  image: Omit<PageImage, "id" | "size" | "createdAt">,
  now = Date.now(),
): Promise<void> {
  // A drawing deleted while its page was being saved: don't keep it.
  if (!(await db.drawings.get(image.drawingId))) return;
  await db.pageImages.put({
    ...image,
    id: pageImageId(image.drawingId, image.source, image.width, image.height),
    size: image.data.byteLength,
    createdAt: now,
  });
}

export function loadPageImage(
  db: InspectionDb,
  id: string,
): Promise<PageImage | undefined> {
  return db.pageImages.get(id);
}

/** The ids of the saved images for these drawings. */
export async function savedPageImageIds(
  db: InspectionDb,
  drawingIds: string[],
): Promise<Set<string>> {
  if (drawingIds.length === 0) return new Set();
  const ids = await db.pageImages
    .where("drawingId")
    .anyOf(drawingIds)
    .primaryKeys();
  return new Set(ids);
}

/** Removes saved images whose drawing is gone; returns how many. */
export async function prunePageImages(db: InspectionDb): Promise<number> {
  const drawingIds = new Set(await db.drawings.toCollection().primaryKeys());
  // By the index: never reads the images themselves.
  const gone = (await db.pageImages.orderBy("drawingId").uniqueKeys())
    .map(String)
    .filter((id) => !drawingIds.has(id));
  if (gone.length === 0) return 0;
  return db.pageImages.where("drawingId").anyOf(gone).delete();
}
