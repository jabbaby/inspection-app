import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { addDrawing, deleteDrawing } from "./drawings";
import { createInspection, deleteInspection } from "./inspections";
import {
  addMarkup,
  deleteMarkups,
  listMarkups,
  restoreMarkups,
} from "./markups";
import {
  countUnmarked,
  duplicatePage,
  movePage,
  setPagesHidden,
} from "./pages";
import { InspectionDb } from "./schema";
import type { Drawing, Inspection } from "./types";

let db: InspectionDb;
let inspection: Inspection;
let drawing: Drawing;

beforeEach(async () => {
  db = new InspectionDb(`test-${crypto.randomUUID()}`);
  inspection = await createInspection(db, new Date(2026, 9, 1));
  drawing = await addDrawing(db, inspection.id, {
    name: "S-101",
    pdf: new TextEncoder().encode("%PDF-1.7 synthetic"),
    pageCount: 3,
    pageSizes: [
      [1191, 842],
      [1191, 842],
      [1191, 842],
    ],
  });
});

afterEach(async () => {
  await db.delete();
});

const mark = (page: number) =>
  addMarkup(
    db,
    {
      inspectionId: inspection.id,
      drawingId: drawing.id,
      page,
      tool: "pen",
      points: [0.1, 0.1, 0.2, 0.2],
      colour: "#DA1A32",
      weight: 0.0025,
    },
    5000,
  );

describe("markup records", () => {
  test("add, delete and restore; each counts as an edit", async () => {
    const a = await mark(1);
    expect((await db.inspections.get(inspection.id))!.updatedAt).toBe(5000);
    await deleteMarkups(db, inspection.id, [a.id], 6000);
    expect(await listMarkups(db, inspection.id)).toEqual([]);
    expect((await db.inspections.get(inspection.id))!.updatedAt).toBe(6000);
    await restoreMarkups(db, [a]);
    expect(await listMarkups(db, inspection.id)).toEqual([a]);
  });

  test("a page with markup can't be hidden, and counts as marked", async () => {
    await mark(2);
    const marks = await listMarkups(db, inspection.id);
    expect(countUnmarked([drawing], [], marks)).toBe(2);
    expect(await setPagesHidden(db, drawing.id, [1, 2, 3], true)).toBe(2);
    const pages = (await db.drawings.get(drawing.id))!.pages;
    expect(pages.map((p) => Boolean(p.hidden))).toEqual([true, false, true]);
  });

  test("duplicating a page moves later markup along; the copy starts clean", async () => {
    const a = await mark(1);
    const b = await mark(2);
    await duplicatePage(db, drawing.id, 1);
    expect((await db.markups.get(a.id))!.page).toBe(1);
    expect((await db.markups.get(b.id))!.page).toBe(3);
    expect(await db.markups.count()).toBe(2);
  });

  test("moving a page takes its markup with it", async () => {
    const a = await mark(1);
    const c = await mark(3);
    await movePage(db, drawing.id, 1, 1);
    expect((await db.markups.get(a.id))!.page).toBe(2);
    expect((await db.markups.get(c.id))!.page).toBe(3);
  });

  test("deleting the drawing or the inspection removes its markup", async () => {
    await mark(1);
    await deleteDrawing(db, drawing.id);
    expect(await db.markups.count()).toBe(0);
    await mark(1);
    await deleteInspection(db, inspection.id);
    expect(await db.markups.count()).toBe(0);
  });
});
