import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  addDrawing,
  deleteDrawing,
  drawingNameFromFile,
  renameDrawing,
} from "./drawings";
import { createInspection } from "./inspections";
import {
  createItem,
  deleteItem,
  moveObservationBox,
  updateItem,
} from "./items";
import { InspectionDb } from "./schema";
import type { Inspection } from "./types";

let db: InspectionDb;
let inspection: Inspection;
const BOX = { x: 0.6, y: 0.02 };

beforeEach(async () => {
  db = new InspectionDb(`test-${crypto.randomUUID()}`);
  inspection = await createInspection(db, new Date(2026, 9, 1));
});

afterEach(async () => {
  await db.delete();
});

async function drawing(name = "S-101", pageCount = 2) {
  return addDrawing(db, inspection.id, {
    name,
    pdf: new TextEncoder().encode("%PDF"),
    pageCount,
  });
}

const pin = (drawingId: string, page = 1, x = 0.5, y = 0.5) =>
  createItem(db, { inspectionId: inspection.id, drawingId, page, x, y }, BOX);

describe("items", () => {
  test("new items are instructions lettered across the whole inspection", async () => {
    const d1 = await drawing("S-101");
    const d2 = await drawing("S-102");
    const a = await pin(d1.id);
    const b = await pin(d2.id);
    const c = await pin(d1.id, 2);

    expect([a.letter, b.letter, c.letter]).toEqual(["A", "B", "C"]);
    expect(a).toMatchObject({
      kind: "instruction",
      text: "",
      requiresPhotoConfirmation: false,
    });
    expect((await db.inspections.get(inspection.id))?.nextLetterIndex).toBe(3);
  });

  test("never reuses a deleted letter", async () => {
    const d = await drawing();
    await pin(d.id);
    await pin(d.id);
    const c = await pin(d.id);
    await deleteItem(db, c.id);
    expect((await pin(d.id)).letter).toBe("D");
  });

  test("updates kind, text, flag and position", async () => {
    const d = await drawing();
    const a = await pin(d.id);
    await updateItem(db, a.id, {
      kind: "observation",
      text: "Crack at grid 4",
      x: 0.1,
      y: 0.9,
    });
    expect(await db.items.get(a.id)).toMatchObject({
      kind: "observation",
      text: "Crack at grid 4",
      x: 0.1,
      y: 0.9,
    });
  });

  test("bumps the inspection's updatedAt", async () => {
    const d = await drawing();
    const a = await pin(d.id);
    await updateItem(db, a.id, { text: "x" }, 999_999_999_999);
    expect((await db.inspections.get(inspection.id))?.updatedAt).toBe(
      999_999_999_999,
    );
  });
});

describe("observation boxes", () => {
  test("one per pinned page, created with the first pin, gone with the last", async () => {
    const d = await drawing();
    const a = await pin(d.id, 1);
    const b = await pin(d.id, 1);
    await pin(d.id, 2);
    expect(await db.observationBoxes.count()).toBe(2);
    const box = await db.observationBoxes
      .where("[drawingId+page]")
      .equals([d.id, 1])
      .first();
    expect(box).toMatchObject({ x: 0.6, y: 0.02 });

    await deleteItem(db, a.id);
    expect(await db.observationBoxes.count()).toBe(2);
    await deleteItem(db, b.id);
    expect(await db.observationBoxes.count()).toBe(1);
  });

  test("keeps a moved box's position when more pins are added", async () => {
    const d = await drawing();
    await pin(d.id);
    const box = (await db.observationBoxes.toCollection().first())!;
    await moveObservationBox(db, box.id, { x: 0.05, y: 0.8 }, inspection.id);
    await pin(d.id);
    expect(await db.observationBoxes.get(box.id)).toMatchObject({
      x: 0.05,
      y: 0.8,
    });
    expect(await db.observationBoxes.count()).toBe(1);
  });
});

describe("drawings", () => {
  test("stores the PDF and names drawings from file names", async () => {
    const d = await drawing("S-101 Level 3", 3);
    const stored = await db.blobs.get(d.pdfBlobId);
    expect(new TextDecoder().decode(stored?.data)).toBe("%PDF");
    expect(stored).toMatchObject({ type: "application/pdf", size: 4 });
    expect(d.fileSize).toBe(4);
    expect(drawingNameFromFile("S-101 Level 3.PDF")).toBe("S-101 Level 3");
    expect(drawingNameFromFile(".pdf")).toBe("Drawing");
  });

  test("renames, keeping the old name if the new one is blank", async () => {
    const d = await drawing("Old");
    await renameDrawing(db, d.id, "  New name ");
    expect((await db.drawings.get(d.id))?.name).toBe("New name");
    await renameDrawing(db, d.id, "   ");
    expect((await db.drawings.get(d.id))?.name).toBe("New name");
  });

  test("deleting removes its PDF, items, photos and boxes but not other drawings'", async () => {
    const doomed = await drawing("Doomed");
    const kept = await drawing("Kept");
    const a = await pin(doomed.id);
    await pin(kept.id);
    await db.blobs.add({
      id: "img",
      ...{
        data: new TextEncoder().encode("jpg").buffer,
        type: "application/octet-stream",
        size: 3,
      },
    });
    await db.photos.add({
      id: "photo",
      blobId: "img",
      takenAt: 0,
      width: 1,
      height: 1,
    });
    await updateItem(db, a.id, {});
    await db.items.update(a.id, { photoIds: ["photo"] });

    await deleteDrawing(db, doomed.id);

    expect(await db.drawings.toArray()).toEqual([kept]);
    expect((await db.items.toArray()).map((i) => i.drawingId)).toEqual([
      kept.id,
    ]);
    expect(await db.photos.count()).toBe(0);
    expect((await db.blobs.toArray()).map((b) => b.id)).toEqual([
      kept.pdfBlobId,
    ]);
    expect(
      (await db.observationBoxes.toArray()).map((b) => b.drawingId),
    ).toEqual([kept.id]);
    // Letters keep counting after a drawing is deleted.
    expect((await pin(kept.id)).letter).toBe("C");
  });
});
