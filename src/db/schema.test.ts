import "fake-indexeddb/auto";
import { Dexie } from "dexie";
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
    expect(SCHEMA_VERSION).toBe(7);
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
      sequence: 0,
      arrows: [],
    });

    const item = await db.items
      .where("[inspectionId+letter]")
      .equals(["insp-1", "A"])
      .first();
    expect(item?.id).toBe("item-1");
  });
});

describe("upgrade from v1", () => {
  test("adds itemInspected", async () => {
    const name = `test-${crypto.randomUUID()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
      inspections: "id, jobNumber, updatedAt",
      items: "id, inspectionId, [inspectionId+letter], drawingId",
    });
    await v1.table("inspections").bulkAdd([
      { id: "with-items", jobNumber: "SY1", jobName: "Tower" },
      { id: "empty", jobNumber: "SY2", jobName: "Shed" },
    ]);
    await v1.table("items").bulkAdd([
      { id: "i1", inspectionId: "with-items", letter: "A" },
      { id: "i2", inspectionId: "with-items", letter: "AB" },
      { id: "i3", inspectionId: "with-items", letter: "C" },
    ]);
    v1.close();

    db = new InspectionDb(name);
    const withItems = await db.inspections.get("with-items");
    const empty = await db.inspections.get("empty");
    expect(withItems?.itemInspected).toBe("");
    expect(withItems?.jobName).toBe("Tower");
    expect(empty?.itemInspected).toBe("");
  });
});

test("v3 upgrade gives existing drawings a createdAt", async () => {
  const name = `test-${crypto.randomUUID()}`;
  const v2 = new Dexie(name);
  v2.version(2).stores({ drawings: "id, inspectionId" });
  await v2.table("drawings").bulkAdd([
    { id: "d1", inspectionId: "i", name: "S-101" },
    { id: "d2", inspectionId: "i", name: "S-102" },
  ]);
  v2.close();

  db = new InspectionDb(name);
  const drawings = await db.drawings.toArray();
  expect(drawings.every((d) => typeof d.createdAt === "number")).toBe(true);
  expect(new Set(drawings.map((d) => d.createdAt)).size).toBe(2);
});

test("v5 upgrade letters each kind in document order", async () => {
  const name = `test-${crypto.randomUUID()}`;
  const v3 = new Dexie(name);
  v3.version(3).stores({
    inspections: "id, jobNumber, updatedAt",
    drawings: "id, inspectionId",
    items: "id, inspectionId, [inspectionId+letter], drawingId",
  });
  await v3
    .table("inspections")
    .add({ id: "insp", jobNumber: "SY1", nextLetterIndex: 5 });
  await v3.table("drawings").bulkAdd([
    { id: "d1", inspectionId: "insp", createdAt: 10 },
    { id: "d2", inspectionId: "insp", createdAt: 20 },
  ]);
  // Old letters ran across both kinds in time order, with a gap.
  const item = (
    id: string,
    kind: string,
    letter: string,
    drawingId: string,
    page: number,
    createdAt: number,
  ) => ({ id, inspectionId: "insp", kind, letter, drawingId, page, createdAt });
  await v3
    .table("items")
    .bulkAdd([
      item("a", "instruction", "A", "d2", 1, 1),
      item("b", "observation", "B", "d1", 1, 2),
      item("d", "instruction", "D", "d1", 2, 4),
      item("e", "observation", "E", "d1", 1, 5),
      item("f", "instruction", "F", "d1", 2, 6),
    ]);
  v3.close();

  db = new InspectionDb(name);
  const letters = Object.fromEntries(
    (await db.items.toArray()).map((i) => [i.id, `${i.kind} ${i.letter}`]),
  );
  expect(letters).toEqual({
    d: "instruction A",
    f: "instruction B",
    a: "instruction C",
    b: "observation A",
    e: "observation B",
  });
  expect(await db.inspections.get("insp")).not.toHaveProperty(
    "nextLetterIndex",
  );
});

test("v6 upgrade gives items their sequence from the creation order", async () => {
  const name = `test-${crypto.randomUUID()}`;
  const v5 = new Dexie(name);
  v5.version(5).stores({
    items: "id, inspectionId, [inspectionId+letter], drawingId",
  });
  await v5.table("items").add({ id: "a", inspectionId: "i", createdAt: 42 });
  v5.close();

  db = new InspectionDb(name);
  expect((await db.items.get("a"))?.sequence).toBe(42);
});

test("v7 upgrade gives items an empty arrow list", async () => {
  const name = `test-${crypto.randomUUID()}`;
  const v6 = new Dexie(name);
  v6.version(6).stores({
    items: "id, inspectionId, [inspectionId+letter], drawingId",
  });
  await v6.table("items").add({ id: "a", inspectionId: "i", sequence: 1 });
  v6.close();

  db = new InspectionDb(name);
  expect((await db.items.get("a"))?.arrows).toEqual([]);
});
