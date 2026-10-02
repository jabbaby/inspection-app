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
  reorderItems,
  restoreItem,
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
    pageSizes: Array.from(
      { length: pageCount },
      () => [2384, 1684] as [number, number],
    ),
  });
}

const pin = (drawingId: string, page = 1, x = 0.5, y = 0.5) =>
  createItem(db, { inspectionId: inspection.id, drawingId, page, x, y }, BOX);

describe("items", () => {
  test("new items are instructions, lettered in document order", async () => {
    const d1 = await drawing("S-101");
    const d2 = await drawing("S-102");
    const a = await pin(d1.id);
    const b = await pin(d2.id);
    expect([a.letter, b.letter]).toEqual(["A", "B"]);
    expect(a).toMatchObject({
      kind: "instruction",
      text: "",
      requiresPhotoConfirmation: false,
    });

    // A later pin on an earlier page takes its place in the document: the
    // S-102 pin moves along to C.
    const c = await pin(d1.id, 2);
    expect(c.letter).toBe("B");
    expect((await db.items.get(b.id))?.letter).toBe("C");

    // On one page, pins keep the order they were placed in.
    const a2 = await pin(d1.id, 1, 0.1, 0.1);
    expect(a2.letter).toBe("B");
    expect(c.createdAt).toBeGreaterThan(b.createdAt);
    expect(b.createdAt).toBeGreaterThan(a.createdAt);
  });

  test("drawings added together keep their order", async () => {
    const d1 = await drawing("S-101");
    const d2 = await drawing("S-102");
    expect(d2.createdAt).toBeGreaterThan(d1.createdAt);
  });

  test("re-letters the rest when one is deleted", async () => {
    const d1 = await drawing("S-101");
    const d2 = await drawing("S-102");
    const a = await pin(d1.id);
    const b = await pin(d1.id, 2);
    const c = await pin(d2.id);
    const dItem = await pin(d2.id);

    await deleteItem(db, b.id);

    const letters = async (id: string) => (await db.items.get(id))?.letter;
    expect([
      await letters(a.id),
      await letters(c.id),
      await letters(dItem.id),
    ]).toEqual(["A", "B", "C"]);
    expect((await pin(d2.id)).letter).toBe("D");
  });

  test("re-letters past Z without gaps", async () => {
    const d = await drawing();
    const items = [];
    for (let i = 0; i < 28; i++) items.push(await pin(d.id));
    expect(items[27].letter).toBe("AB");
    await deleteItem(db, items[0].id);
    expect((await db.items.get(items[27].id))?.letter).toBe("AA");
    expect((await db.items.get(items[1].id))?.letter).toBe("A");
  });

  test("instructions and observations are lettered separately", async () => {
    const d = await drawing();
    const a = await pin(d.id);
    const b = await pin(d.id);
    const c = await pin(d.id);
    const letter = async (id: string) => {
      const item = (await db.items.get(id))!;
      return `${item.kind} ${item.letter}`;
    };

    // Switching B moves it to the observations; C closes the gap.
    await updateItem(db, b.id, { kind: "observation" });
    expect([
      await letter(a.id),
      await letter(b.id),
      await letter(c.id),
    ]).toEqual(["instruction A", "observation A", "instruction B"]);

    // A new pin is the next instruction.
    const dItem = await pin(d.id);
    expect(dItem.letter).toBe("C");

    // Switching A too: observations follow creation order (A before B).
    await updateItem(db, a.id, { kind: "observation" });
    expect([
      await letter(a.id),
      await letter(b.id),
      await letter(c.id),
      await letter(dItem.id),
    ]).toEqual([
      "observation A",
      "observation B",
      "instruction A",
      "instruction B",
    ]);

    // Deleting an observation re-letters only the observations.
    await deleteItem(db, a.id);
    expect([await letter(b.id), await letter(c.id)]).toEqual([
      "observation A",
      "instruction A",
    ]);
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

describe("undoing a delete", () => {
  test("restores the item, its photo, its notes box and the letters", async () => {
    const d = await drawing();
    const a = await pin(d.id);
    const b = await pin(d.id);
    await db.blobs.add({
      id: "img",
      data: new ArrayBuffer(4),
      type: "image/jpeg",
      size: 4,
    });
    await db.photos.add({
      id: "ph",
      blobId: "img",
      takenAt: 0,
      width: 10,
      height: 10,
    });
    await updateItem(db, a.id, { text: "Add bar" });
    await db.items.update(a.id, { photoIds: ["ph"] });

    const deleted = await deleteItem(db, a.id);
    expect((await db.items.get(b.id))?.letter).toBe("A");
    await restoreItem(db, deleted!);

    expect(await db.items.get(a.id)).toMatchObject({
      letter: "A",
      text: "Add bar",
    });
    expect((await db.items.get(b.id))?.letter).toBe("B");
    expect(await db.photos.get("ph")).toBeDefined();
    expect(await db.blobs.get("img")).toBeDefined();
  });

  test("brings back the notes box with its last pin, where it was", async () => {
    const d = await drawing();
    const a = await pin(d.id);
    const box = (await db.observationBoxes.toArray())[0];
    await moveObservationBox(db, box.id, { x: 0.1, y: 0.2 }, inspection.id);

    const deleted = await deleteItem(db, a.id);
    expect(await db.observationBoxes.count()).toBe(0);
    await restoreItem(db, deleted!);
    expect(await db.observationBoxes.get(box.id)).toMatchObject({
      x: 0.1,
      y: 0.2,
    });
  });

  test("does nothing once the drawing is gone", async () => {
    const d = await drawing();
    const deleted = await deleteItem(db, (await pin(d.id)).id);
    await deleteDrawing(db, d.id);
    await restoreItem(db, deleted!);
    expect(await db.items.count()).toBe(0);
  });
});

describe("reordering", () => {
  test("reorders one kind on one page and re-letters, reversibly", async () => {
    const d = await drawing();
    const a = await pin(d.id);
    const b = await pin(d.id);
    const c = await pin(d.id);
    const later = await pin(d.id, 2);
    const letter = async (id: string) => (await db.items.get(id))?.letter;

    const previous = await reorderItems(db, [c.id, a.id, b.id]);
    expect([
      await letter(c.id),
      await letter(a.id),
      await letter(b.id),
    ]).toEqual(["A", "B", "C"]);
    expect(await letter(later.id)).toBe("D");

    await reorderItems(db, previous);
    expect([
      await letter(a.id),
      await letter(b.id),
      await letter(c.id),
    ]).toEqual(["A", "B", "C"]);
  });

  test("refuses items from different pages", async () => {
    const d = await drawing();
    const a = await pin(d.id, 1);
    const b = await pin(d.id, 2);
    await expect(reorderItems(db, [b.id, a.id])).rejects.toThrow();
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
    // The kept drawing's item becomes A, so the next pin is B.
    expect((await pin(kept.id)).letter).toBe("B");
  });
});
