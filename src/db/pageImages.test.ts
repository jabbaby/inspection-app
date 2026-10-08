import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import {
  loadPageImage,
  pageImageId,
  prunePageImages,
  savedPageImageIds,
  savePageImage,
} from "./pageImages";
import { InspectionDb } from "./schema";
import type { Drawing } from "./types";

let db: InspectionDb;

afterEach(async () => {
  db.close();
  await db.delete();
});

function drawing(id: string): Drawing {
  return {
    id,
    inspectionId: "insp-1",
    name: "S-101",
    pdfBlobId: `blob-${id}`,
    pageCount: 2,
    pages: [{ source: 1 }, { source: 2 }],
    fileSize: 1000,
    pageSizes: [
      [2384, 1684],
      [2384, 1684],
    ],
    createdAt: 1,
  };
}

const png = (n: number) => new Uint8Array(n).buffer;

describe("saved page images", () => {
  test("saves, finds and loads a page's image by its size", async () => {
    db = new InspectionDb(`test-${crypto.randomUUID()}`);
    await db.drawings.add(drawing("d1"));
    await savePageImage(db, {
      drawingId: "d1",
      source: 2,
      width: 2380,
      height: 1680,
      data: png(500),
    });
    const id = pageImageId("d1", 2, 2380, 1680);
    expect(await savedPageImageIds(db, ["d1"])).toEqual(new Set([id]));
    const image = await loadPageImage(db, id);
    expect(image?.size).toBe(500);
    expect(await loadPageImage(db, pageImageId("d1", 2, 1600, 1130))).toBe(
      undefined,
    );
  });

  test("never keeps an image for a drawing that's gone", async () => {
    db = new InspectionDb(`test-${crypto.randomUUID()}`);
    await db.drawings.bulkAdd([drawing("d1"), drawing("d2")]);
    for (const drawingId of ["d1", "d2"])
      await savePageImage(db, {
        drawingId,
        source: 1,
        width: 10,
        height: 10,
        data: png(10),
      });
    await db.drawings.delete("d1");
    expect(await prunePageImages(db)).toBe(1);
    expect(await savedPageImageIds(db, ["d1", "d2"])).toEqual(
      new Set([pageImageId("d2", 1, 10, 10)]),
    );
    // Saving for a deleted drawing does nothing.
    await savePageImage(db, {
      drawingId: "d1",
      source: 1,
      width: 10,
      height: 10,
      data: png(10),
    });
    expect(await db.pageImages.count()).toBe(1);
  });
});
