import { deleteItemRecords, touchInspection } from "./items";
import type { InspectionDb } from "./schema";
import type { Drawing } from "./types";

export interface NewDrawing {
  name: string;
  /** PDF bytes. Copied, so the caller can keep using its array. */
  pdf: Uint8Array;
  pageCount: number;
}

/** "S-101 Level 3.pdf" -> "S-101 Level 3". */
export function drawingNameFromFile(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").trim() || "Drawing";
}

/** Stores the PDF and its drawing record together. */
export async function addDrawing(
  db: InspectionDb,
  inspectionId: string,
  drawing: NewDrawing,
  now = Date.now(),
): Promise<Drawing> {
  return db.transaction(
    "rw",
    [db.inspections, db.drawings, db.blobs],
    async () => {
      const pdfBlobId = crypto.randomUUID();
      await db.blobs.add({
        id: pdfBlobId,
        data: drawing.pdf.slice().buffer,
        type: "application/pdf",
        size: drawing.pdf.byteLength,
      });
      const record: Drawing = {
        id: crypto.randomUUID(),
        inspectionId,
        name: drawing.name,
        pdfBlobId,
        pageCount: drawing.pageCount,
        fileSize: drawing.pdf.byteLength,
      };
      await db.drawings.add(record);
      await touchInspection(db, inspectionId, now);
      return record;
    },
  );
}

export async function renameDrawing(
  db: InspectionDb,
  id: string,
  name: string,
  now = Date.now(),
): Promise<void> {
  await db.transaction("rw", [db.inspections, db.drawings], async () => {
    const drawing = await db.drawings.get(id);
    if (!drawing) throw new Error(`Drawing ${id} not found`);
    await db.drawings.update(id, { name: name.trim() || drawing.name });
    await touchInspection(db, drawing.inspectionId, now);
  });
}

/**
 * Deletes a drawing, its PDF, its items (with photos) and its observation
 * boxes. Deleted items' letters are not reused.
 */
export async function deleteDrawing(
  db: InspectionDb,
  id: string,
  now = Date.now(),
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.inspections,
      db.drawings,
      db.blobs,
      db.items,
      db.photos,
      db.observationBoxes,
    ],
    async () => {
      const drawing = await db.drawings.get(id);
      if (!drawing) return;
      const items = await db.items.where("drawingId").equals(id).toArray();
      await deleteItemRecords(db, items);
      await db.observationBoxes.filter((box) => box.drawingId === id).delete();
      await db.blobs.delete(drawing.pdfBlobId);
      await db.drawings.delete(id);
      await touchInspection(db, drawing.inspectionId, now);
    },
  );
}
