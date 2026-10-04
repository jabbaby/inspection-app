import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  addDrawing,
  listDrawings,
  moveDrawing,
  reorderDrawings,
} from "./drawings";
import { createInspection } from "./inspections";
import { createItem } from "./items";
import {
  countUnmarked,
  duplicatePage,
  hideUnmarkedPages,
  movePage,
  pageMoveTarget,
  setPagesHidden,
} from "./pages";
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

async function drawing(pageCount = 3) {
  return addDrawing(db, inspection.id, {
    name: "S-101",
    pdf: new TextEncoder().encode("%PDF"),
    pageCount,
    pageSizes: Array.from(
      { length: pageCount },
      () => [2384, 1684] as [number, number],
    ),
  });
}

function pin(drawingId: string, page: number, x = 0.5) {
  return createItem(
    db,
    { inspectionId: inspection.id, drawingId, page, x, y: 0.5 },
    BOX,
  );
}

describe("drawing pages", () => {
  test("a new drawing lists each PDF page once", async () => {
    const d = await drawing(3);
    expect(d.pages).toEqual([{ source: 1 }, { source: 2 }, { source: 3 }]);
  });

  test("hiding skips pages with pins; restoring brings pages back", async () => {
    const d = await drawing(3);
    await pin(d.id, 2);
    expect(await setPagesHidden(db, d.id, [1, 2, 3], true)).toBe(2);
    expect((await db.drawings.get(d.id))!.pages).toEqual([
      { source: 1, hidden: true },
      { source: 2 },
      { source: 3, hidden: true },
    ]);
    expect(await setPagesHidden(db, d.id, [3], false)).toBe(1);
    expect((await db.drawings.get(d.id))!.pages[2]).toEqual({ source: 3 });
  });

  test("duplicating puts a copy after the page and moves later pins along", async () => {
    const d = await drawing(3);
    const onOne = await pin(d.id, 1);
    const onThree = await pin(d.id, 3);
    await db.observationBoxes.add({
      id: "box3",
      drawingId: d.id,
      page: 3,
      ...BOX,
    });

    expect(await duplicatePage(db, d.id, 2)).toBe(3);
    expect((await db.drawings.get(d.id))!.pages).toEqual([
      { source: 1 },
      { source: 2 },
      { source: 2 },
      { source: 3 },
    ]);
    expect((await db.items.get(onOne.id))!.page).toBe(1);
    expect((await db.items.get(onThree.id))!.page).toBe(4);
    expect((await db.observationBoxes.get("box3"))!.page).toBe(4);
  });

  test("a duplicate of a pinned page starts without pins", async () => {
    const d = await drawing(1);
    await pin(d.id, 1);
    await duplicatePage(db, d.id, 1);
    const items = await db.items.toArray();
    expect(items.map((i) => i.page)).toEqual([1]);
  });

  test("hide unmarked pages hides every visible page without pins", async () => {
    const a = await drawing(3);
    const b = await drawing(2);
    await pin(a.id, 1);
    await pin(b.id, 2);
    const drawings = await db.drawings.toArray();
    expect(countUnmarked(drawings, await db.items.toArray())).toBe(3);
    expect(await hideUnmarkedPages(db, inspection.id)).toBe(3);
    const after = await db.drawings.toArray();
    expect(countUnmarked(after, await db.items.toArray())).toBe(0);
  });
});

describe("moving pages and drawings", () => {
  test("pageMoveTarget steps over hidden pages and stops at the ends", () => {
    const pages = [{ source: 1 }, { source: 2, hidden: true }, { source: 3 }];
    expect(pageMoveTarget(pages, 1, 1)).toBe(3);
    expect(pageMoveTarget(pages, 3, -1)).toBe(1);
    expect(pageMoveTarget(pages, 1, -1)).toBeNull();
    expect(pageMoveTarget(pages, 3, 1)).toBeNull();
  });

  test("a page moves with its pins and notes box; letters follow", async () => {
    const d = await drawing(3);
    const onOne = await pin(d.id, 1);
    const onThree = await pin(d.id, 3);
    expect([onOne.letter, (await db.items.get(onThree.id))!.letter]).toEqual([
      "A",
      "B",
    ]);
    expect(await movePage(db, d.id, 3, -1)).toBe(2);
    expect(await movePage(db, d.id, 2, -1)).toBe(1);
    expect((await db.drawings.get(d.id))!.pages).toEqual([
      { source: 3 },
      { source: 1 },
      { source: 2 },
    ]);
    const [one, three] = await db.items.bulkGet([onOne.id, onThree.id]);
    expect([one!.page, one!.letter]).toEqual([2, "B"]);
    expect([three!.page, three!.letter]).toEqual([1, "A"]);
    const boxes = await db.observationBoxes.toArray();
    expect(boxes.map((b) => b.page).sort()).toEqual([1, 2]);
    // Already first: nothing changes.
    expect(await movePage(db, d.id, 1, -1)).toBe(1);
  });

  test("reordering drawings re-letters in the new document order", async () => {
    const a = await drawing(1);
    const b = await drawing(1);
    const pinA = await pin(a.id, 1);
    const pinB = await pin(b.id, 1);
    await moveDrawing(db, b.id, -1);
    expect((await listDrawings(db, inspection.id)).map((d) => d.id)).toEqual([
      b.id,
      a.id,
    ]);
    const [ia, ib] = await db.items.bulkGet([pinA.id, pinB.id]);
    expect([ia!.letter, ib!.letter]).toEqual(["B", "A"]);
    // A new drawing still goes last.
    const c = await drawing(1);
    expect((await listDrawings(db, inspection.id)).at(-1)!.id).toBe(c.id);
    await reorderDrawings(db, inspection.id, [c.id, a.id, b.id]);
    expect((await listDrawings(db, inspection.id)).map((d) => d.id)).toEqual([
      c.id,
      a.id,
      b.id,
    ]);
    await expect(
      reorderDrawings(db, inspection.id, [a.id, b.id]),
    ).rejects.toThrow();
  });
});
