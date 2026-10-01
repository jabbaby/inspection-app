import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import { InspectionDb, SCHEMA_VERSION } from "./schema";

let db: InspectionDb;

afterEach(async () => {
  await db.delete();
});

describe("InspectionDb", () => {
  test("opens with every v1 table", async () => {
    db = new InspectionDb(`test-${crypto.randomUUID()}`);
    await db.open();

    expect(db.tables.map((t) => t.name).sort()).toEqual([
      "blobs",
      "drawings",
      "inspections",
      "items",
      "memoCounters",
      "memoTemplates",
      "memos",
      "observationBoxes",
      "photos",
      "settings",
      "snippets",
    ]);
    expect(SCHEMA_VERSION).toBe(1);
  });

  test("finds an item by inspection and letter", async () => {
    db = new InspectionDb(`test-${crypto.randomUUID()}`);
    await db.items.add({
      id: "item-1",
      inspectionId: "insp-1",
      letter: "A",
      kind: "instruction",
      drawingId: "dwg-1",
      page: 1,
      x: 0.25,
      y: 0.75,
      text: "Add N16 bar at grid C",
      requiresPhotoConfirmation: true,
      photoIds: [],
      createdAt: 0,
    });

    const item = await db.items
      .where("[inspectionId+letter]")
      .equals(["insp-1", "A"])
      .first();
    expect(item?.id).toBe("item-1");
  });
});
