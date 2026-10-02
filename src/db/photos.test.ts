import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { addDrawing } from "./drawings";
import { createInspection, deleteInspection } from "./inspections";
import { createItem, deleteItem, updateItem } from "./items";
import {
  addPhotos,
  deletePhoto,
  listInspectionPhotos,
  markPhotosSaved,
  removeOriginals,
  restorePhoto,
  setPhotoCaption,
  type NewPhoto,
} from "./photos";
import { InspectionDb } from "./schema";
import type { Inspection, Item } from "./types";

let db: InspectionDb;
let inspection: Inspection;
let item: Item;

const bytes = (n: number) => new Uint8Array(n).buffer;
const camera = (n = 1): NewPhoto => ({
  data: bytes(10 * n),
  type: "image/jpeg",
  width: 1600,
  height: 1200,
  takenAt: n,
  source: "camera",
  original: { data: bytes(1000 * n), type: "image/jpeg" },
});
const library = (n = 1): NewPhoto => ({
  ...camera(n),
  source: "library",
  original: undefined,
});

beforeEach(async () => {
  db = new InspectionDb(`test-${crypto.randomUUID()}`);
  inspection = await createInspection(db, new Date(2026, 9, 1));
  const drawing = await addDrawing(db, inspection.id, {
    name: "S-101",
    pdf: new TextEncoder().encode("%PDF"),
    pageCount: 1,
    pageSizes: [[2384, 1684]],
  });
  item = await createItem(
    db,
    {
      inspectionId: inspection.id,
      drawingId: drawing.id,
      page: 1,
      x: 0.5,
      y: 0.5,
    },
    { x: 0.6, y: 0.02 },
  );
});

afterEach(async () => {
  await db.delete();
});

describe("photos", () => {
  test("are added to the end of an item, camera shots with their originals", async () => {
    const [a, b] = await addPhotos(db, { itemId: item.id }, [
      camera(1),
      library(2),
    ]);
    expect((await db.items.get(item.id))?.photoIds).toEqual([a.id, b.id]);
    expect(a.originalBlobId).toBeDefined();
    expect(b.originalBlobId).toBeUndefined();
    expect(await db.blobs.count()).toBe(1 + 3); // drawing PDF + 3 photo files
  });

  test("delete with both files, and come back where they were on undo", async () => {
    const [a, b, c] = await addPhotos(db, { itemId: item.id }, [
      camera(1),
      camera(2),
      camera(3),
    ]);
    const deleted = await deletePhoto(db, { itemId: item.id }, b.id);
    expect((await db.items.get(item.id))?.photoIds).toEqual([a.id, c.id]);
    expect(await db.blobs.count()).toBe(1 + 4);

    await restorePhoto(db, deleted!);
    expect((await db.items.get(item.id))?.photoIds).toEqual([a.id, b.id, c.id]);
    expect(await db.blobs.count()).toBe(1 + 6);
  });

  test("captions save", async () => {
    const [a] = await addPhotos(db, { itemId: item.id }, [camera()]);
    await setPhotoCaption(db, a.id, "Lap at grid C", inspection.id);
    expect((await db.photos.get(a.id))?.caption).toBe("Lap at grid C");
  });

  test("originals can be freed once saved; working copies stay", async () => {
    const [a, b] = await addPhotos(db, { itemId: item.id }, [
      camera(1),
      library(2),
    ]);
    await markPhotosSaved(db, [a.id, b.id], 123);
    expect((await db.photos.get(a.id))?.savedAt).toBe(123);

    const freed = await removeOriginals(db, [a.id, b.id]);
    expect(freed).toBe(1000);
    expect((await db.photos.get(a.id))?.originalBlobId).toBeUndefined();
    expect(await db.blobs.get(a.blobId)).toBeDefined();
  });

  test("go with their item, originals included", async () => {
    await addPhotos(db, { itemId: item.id }, [camera(1), camera(2)]);
    const deleted = await deleteItem(db, item.id);
    expect(await db.photos.count()).toBe(0);
    expect(await db.blobs.count()).toBe(1);
    expect(deleted?.blobs).toHaveLength(4);
  });

  test("go with their inspection, originals included", async () => {
    await addPhotos(db, { itemId: item.id }, [camera(1)]);
    await deleteInspection(db, inspection.id);
    expect(await db.blobs.count()).toBe(0);
  });

  test("are listed for the whole inspection in item order", async () => {
    const second = await createItem(
      db,
      {
        inspectionId: inspection.id,
        drawingId: item.drawingId,
        page: 1,
        x: 0.2,
        y: 0.2,
      },
      { x: 0.6, y: 0.02 },
    );
    await updateItem(db, second.id, { kind: "observation" });
    await addPhotos(db, { itemId: item.id }, [camera(1), camera(2)]);
    await addPhotos(db, { itemId: second.id }, [camera(3)]);
    const listed = await listInspectionPhotos(db, inspection.id);
    // Observations come first in the lists.
    expect(
      listed.map((p) => `${p.item?.kind} ${p.item?.letter} ${p.number}`),
    ).toEqual(["observation A 1", "instruction A 1", "instruction A 2"]);
  });
});

describe("general photos", () => {
  test("belong to the inspection, list after the items, and go with it", async () => {
    const owner = { inspectionId: inspection.id };
    await addPhotos(db, { itemId: item.id }, [camera(1)]);
    const [g1, g2] = await addPhotos(db, owner, [camera(2), library(3)]);
    expect((await db.inspections.get(inspection.id))?.photoIds).toEqual([
      g1.id,
      g2.id,
    ]);

    const listed = await listInspectionPhotos(db, inspection.id);
    expect(
      listed.map((p) =>
        p.item ? `${p.item.letter}${p.number}` : `G${p.number}`,
      ),
    ).toEqual(["A1", "G1", "G2"]);

    const deleted = await deletePhoto(db, owner, g1.id);
    expect((await db.inspections.get(inspection.id))?.photoIds).toEqual([
      g2.id,
    ]);
    await restorePhoto(db, deleted!);
    expect((await db.inspections.get(inspection.id))?.photoIds).toEqual([
      g1.id,
      g2.id,
    ]);

    await deleteInspection(db, inspection.id);
    expect(await db.photos.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });
});
