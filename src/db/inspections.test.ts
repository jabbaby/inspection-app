import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createInspection,
  deleteInspection,
  missingJobFields,
  updateInspection,
} from "./inspections";
import { InspectionDb } from "./schema";
import { ensureSeeded } from "./seed";
import { SETTINGS_ID } from "./types";

let db: InspectionDb;

beforeEach(async () => {
  db = new InspectionDb(`test-${crypto.randomUUID()}`);
  await ensureSeeded(db);
});

afterEach(async () => {
  await db.delete();
});

describe("createInspection", () => {
  test("creates a dated draft with the inspector from Settings", async () => {
    await db.settings.update(SETTINGS_ID, { inspectorName: "Test Engineer" });
    const now = new Date(2026, 9, 1, 9, 30); // 1 Oct 2026, local time

    const created = await createInspection(db, now);

    expect(await db.inspections.get(created.id)).toEqual({
      id: created.id,
      jobNumber: "",
      jobName: "",
      itemInspected: "",
      client: { name: "", company: "", address1: "", address2: "" },
      date: "2026-10-01",
      inspector: "Test Engineer",
      status: "draft",
      nextLetterIndex: 0,
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    });
  });

  test("leaves the inspector blank when Settings has none", async () => {
    const created = await createInspection(db);
    expect(created.inspector).toBe("");
  });
});

describe("updateInspection", () => {
  test("saves fields, merges client fields and bumps updatedAt", async () => {
    const created = await createInspection(db, new Date(2026, 9, 1));
    await updateInspection(
      db,
      created.id,
      { client: { company: "Example Builders" } },
      1000,
    );
    await updateInspection(
      db,
      created.id,
      { jobNumber: "SY000001", client: { name: "Alex Example" } },
      2000,
    );

    const saved = await db.inspections.get(created.id);
    expect(saved?.jobNumber).toBe("SY000001");
    expect(saved?.client).toEqual({
      name: "Alex Example",
      company: "Example Builders",
      address1: "",
      address2: "",
    });
    expect(saved?.updatedAt).toBe(2000);
    expect(saved?.createdAt).toBe(created.createdAt);
  });

  test("fails for an unknown inspection", async () => {
    await expect(
      updateInspection(db, "missing", { jobName: "x" }),
    ).rejects.toThrow("not found");
  });
});

describe("deleteInspection", () => {
  test("removes the inspection and everything that belongs to it", async () => {
    const keep = await createInspection(db);
    const doomed = await createInspection(db);

    const seed = async (inspectionId: string, tag: string) => {
      await db.blobs.bulkAdd([
        {
          id: `pdf-${tag}`,
          ...{
            data: new TextEncoder().encode("pdf").buffer,
            type: "application/octet-stream",
            size: 3,
          },
        },
        {
          id: `img-${tag}`,
          ...{
            data: new TextEncoder().encode("jpg").buffer,
            type: "application/octet-stream",
            size: 3,
          },
        },
      ]);
      await db.drawings.add({
        id: `dwg-${tag}`,
        inspectionId,
        name: "S-101",
        pdfBlobId: `pdf-${tag}`,
        pageCount: 1,
        fileSize: 3,
        createdAt: 0,
      });
      await db.photos.add({
        id: `photo-${tag}`,
        blobId: `img-${tag}`,
        takenAt: 0,
        width: 1600,
        height: 1200,
      });
      await db.items.add({
        id: `item-${tag}`,
        inspectionId,
        letter: "A",
        kind: "observation",
        drawingId: `dwg-${tag}`,
        page: 1,
        x: 0.5,
        y: 0.5,
        text: "Synthetic observation",
        requiresPhotoConfirmation: false,
        photoIds: [`photo-${tag}`],
        createdAt: 0,
      });
      await db.observationBoxes.add({
        id: `box-${tag}`,
        drawingId: `dwg-${tag}`,
        page: 1,
        x: 0.1,
        y: 0.1,
      });
      await db.memos.add({
        id: `memo-${tag}`,
        inspectionId,
        templateId: "northrop",
        reference: "SIM-001",
        fields: {} as never,
        bodyBlocks: [],
        conditionBlocks: [],
        updatedAt: 0,
      });
    };
    await seed(keep.id, "keep");
    await seed(doomed.id, "doomed");
    await db.memoCounters.put({ jobNumber: "SY000001", lastSeq: 1 });

    await deleteInspection(db, doomed.id);

    expect(await db.inspections.get(doomed.id)).toBeUndefined();
    for (const table of [
      db.drawings,
      db.items,
      db.photos,
      db.observationBoxes,
      db.memos,
    ]) {
      expect(await table.count()).toBe(1);
    }
    expect((await db.blobs.toArray()).map((b) => b.id).sort()).toEqual([
      "img-keep",
      "pdf-keep",
    ]);
    expect(await db.inspections.get(keep.id)).toBeDefined();
    expect(await db.memoCounters.get("SY000001")).toEqual({
      jobNumber: "SY000001",
      lastSeq: 1,
    });
  });
});

test("missingJobFields flags job number and job name", async () => {
  const created = await createInspection(db);
  expect(missingJobFields(created)).toEqual(["jobNumber", "jobName"]);
  expect(
    missingJobFields({ ...created, jobNumber: "SY1", jobName: "  " }),
  ).toEqual(["jobName"]);
  expect(
    missingJobFields({ ...created, jobNumber: "SY1", jobName: "Tower" }),
  ).toEqual([]);
});
