import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { addDrawing, deleteDrawing, reorderDrawings } from "./drawings";
import { createInspection } from "./inspections";
import {
  addCopy,
  createItem,
  deleteItem,
  removeCopy,
  removeOriginalSpot,
  restoreCopy,
  restoreItem,
  restoreOriginalSpot,
  updateCopy,
} from "./items";
import { duplicatePage, movePage, setPagesHidden } from "./pages";
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

const drawing = (pageCount = 3) =>
  addDrawing(db, inspection.id, {
    name: "S-101",
    pdf: new TextEncoder().encode("%PDF"),
    pageCount,
    pageSizes: Array.from(
      { length: pageCount },
      () => [2384, 1684] as [number, number],
    ),
  });

const pin = (drawingId: string, page: number) =>
  createItem(
    db,
    { inspectionId: inspection.id, drawingId, page, x: 0.5, y: 0.5 },
    BOX,
  );

const boxPages = async () =>
  (await db.observationBoxes.toArray()).map((b) => String(b.page)).sort();

describe("pin copies", () => {
  test("a copy keeps the letter and never re-letters; its page gets a notes box", async () => {
    const d = await drawing(3);
    const a = await pin(d.id, 3);
    const b = await pin(d.id, 3);
    expect([a.letter, (await db.items.get(b.id))!.letter]).toEqual(["A", "B"]);
    // A copy of B on page 1 (before A's page): letters stay as they are.
    const copy = await addCopy(
      db,
      b.id,
      { drawingId: d.id, page: 1, x: 0.2, y: 0.3 },
      BOX,
    );
    const [ia, ib] = await db.items.bulkGet([a.id, b.id]);
    expect([ia!.letter, ib!.letter]).toEqual(["A", "B"]);
    expect(ib!.copies).toEqual([copy]);
    expect(await boxPages()).toEqual(["1", "3"]);

    await updateCopy(db, b.id, copy.id, {
      x: 0.25,
      arrows: [{ id: "t", x: 0.3, y: 0.4 }],
    });
    expect((await db.items.get(b.id))!.copies![0]).toMatchObject({
      x: 0.25,
      arrows: [{ id: "t", x: 0.3, y: 0.4 }],
    });

    // Removing the copy takes page 1's box; undo puts both back.
    const removed = await removeCopy(db, b.id, copy.id);
    expect((await db.items.get(b.id))!.copies).toEqual([]);
    expect(await boxPages()).toEqual(["3"]);
    await restoreCopy(db, removed!);
    expect((await db.items.get(b.id))!.copies).toHaveLength(1);
    expect(await boxPages()).toEqual(["1", "3"]);
  });

  test("a page with only a copy counts as having pins", async () => {
    const d = await drawing(3);
    const a = await pin(d.id, 1);
    await addCopy(db, a.id, { drawingId: d.id, page: 2, x: 0.1, y: 0.1 }, BOX);
    expect(await setPagesHidden(db, d.id, [2, 3], true)).toBe(1);
    expect((await db.drawings.get(d.id))!.pages[1].hidden).toBeUndefined();
  });

  test("removing the original spot promotes the first copy; undo restores", async () => {
    const d = await drawing(3);
    const a = await pin(d.id, 1);
    const b = await pin(d.id, 2);
    await addCopy(db, a.id, { drawingId: d.id, page: 3, x: 0.7, y: 0.7 }, BOX);
    const removed = await removeOriginalSpot(db, a.id);
    const [ia, ib] = await db.items.bulkGet([a.id, b.id]);
    // A's pin now lives on page 3, after B: letters follow.
    expect([ia!.page, ia!.x, ia!.copies]).toEqual([3, 0.7, []]);
    expect([ia!.letter, ib!.letter]).toEqual(["B", "A"]);
    expect(await boxPages()).toEqual(["2", "3"]);

    await restoreOriginalSpot(db, removed!);
    const [ra, rb] = await db.items.bulkGet([a.id, b.id]);
    expect([ra!.page, ra!.copies!.length]).toEqual([1, 1]);
    expect([ra!.letter, rb!.letter]).toEqual(["A", "B"]);
    expect(await boxPages()).toEqual(["1", "2", "3"]);
    // Without copies there's nothing to promote.
    expect(await removeOriginalSpot(db, b.id)).toBeNull();
  });

  test("deleting an item removes its copies' notes boxes; undo brings them back", async () => {
    const d = await drawing(3);
    const a = await pin(d.id, 1);
    await addCopy(db, a.id, { drawingId: d.id, page: 2, x: 0.1, y: 0.1 }, BOX);
    const deleted = await deleteItem(db, a.id);
    expect(await boxPages()).toEqual([]);
    await restoreItem(db, deleted!);
    expect((await db.items.get(a.id))!.copies).toHaveLength(1);
    expect(await boxPages()).toEqual(["1", "2"]);
  });

  test("copies move with duplicated and moved pages", async () => {
    const d = await drawing(3);
    const other = await drawing(1);
    const a = await pin(other.id, 1);
    await addCopy(db, a.id, { drawingId: d.id, page: 2, x: 0.1, y: 0.1 }, BOX);
    await duplicatePage(db, d.id, 1);
    expect((await db.items.get(a.id))!.copies![0].page).toBe(3);
    await movePage(db, d.id, 3, -1);
    expect((await db.items.get(a.id))!.copies![0].page).toBe(2);
  });

  test("deleting a drawing: copies on it go; an original on it hands over to a copy", async () => {
    const d1 = await drawing(1);
    const d2 = await drawing(1);
    const a = await pin(d1.id, 1);
    const b = await pin(d2.id, 1);
    await addCopy(db, a.id, { drawingId: d2.id, page: 1, x: 0.2, y: 0.2 }, BOX);
    await addCopy(db, b.id, { drawingId: d1.id, page: 1, x: 0.3, y: 0.3 }, BOX);
    await deleteDrawing(db, d1.id);
    const [ia, ib] = await db.items.bulkGet([a.id, b.id]);
    expect([ia!.drawingId, ia!.x, ia!.copies]).toEqual([d2.id, 0.2, []]);
    expect(ib!.copies).toEqual([]);
    expect(await db.items.count()).toBe(2);
  });

  test("reordering drawings doesn't touch copies", async () => {
    const d1 = await drawing(1);
    const d2 = await drawing(1);
    const a = await pin(d1.id, 1);
    await addCopy(db, a.id, { drawingId: d2.id, page: 1, x: 0.2, y: 0.2 }, BOX);
    await reorderDrawings(db, inspection.id, [d2.id, d1.id]);
    const item = await db.items.get(a.id);
    expect([item!.drawingId, item!.letter, item!.copies![0].drawingId]).toEqual(
      [d1.id, "A", d2.id],
    );
  });
});
