import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createInspection,
  deleteInspection,
  updateInspection,
} from "./inspections";
import { createMemo } from "./memos";
import { InspectionDb } from "./schema";
import { ensureSeeded } from "./seed";
import {
  clearMySignature,
  setMemoSignature,
  setMySignature,
} from "./signatures";
import { SETTINGS_ID } from "./types";

let db: InspectionDb;

beforeEach(async () => {
  db = new InspectionDb(`test-${crypto.randomUUID()}`);
  await ensureSeeded(db);
});

afterEach(async () => {
  await db.delete();
});

const png = (n: number) => new Uint8Array([137, 80, 78, 71, n]);

async function newMemo() {
  const inspection = await createInspection(db, new Date(2026, 9, 1));
  await updateInspection(db, inspection.id, {
    jobNumber: "SY000001",
    jobName: "Example Apartments",
  });
  return createMemo(db, inspection.id);
}

async function bytes(blobId: string | null | undefined) {
  const blob = blobId ? await db.blobs.get(blobId) : undefined;
  return blob ? Array.from(new Uint8Array(blob.data)) : null;
}

describe("signatures", () => {
  test("a new memo gets its own copy of my signature", async () => {
    await setMySignature(db, png(1));
    const memo = await newMemo();
    const settings = await db.settings.get(SETTINGS_ID);
    expect(memo.signatureBlobId).not.toBe(settings?.signatureBlobId);
    expect(await bytes(memo.signatureBlobId)).toEqual([137, 80, 78, 71, 1]);
    expect(memo.includeSignature).toBe(true);

    // Changing or removing mine leaves the memo's copy alone.
    await setMySignature(db, png(2));
    await clearMySignature(db);
    expect(await bytes(memo.signatureBlobId)).toEqual([137, 80, 78, 71, 1]);
    expect(await db.blobs.count()).toBe(1);
  });

  test("a memo created without a saved signature has none", async () => {
    const memo = await newMemo();
    expect(memo.signatureBlobId).toBeNull();
  });

  test("the first signature drawn on a memo is also saved as mine", async () => {
    const memo = await newMemo();
    const id = await setMemoSignature(db, memo.id, png(3));
    const settings = await db.settings.get(SETTINGS_ID);
    expect(await bytes(settings?.signatureBlobId)).toEqual([
      137, 80, 78, 71, 3,
    ]);
    expect(settings?.signatureBlobId).not.toBe(id);

    // Later ones are for that memo only, and replace its old one.
    const next = await setMemoSignature(db, memo.id, png(4));
    expect(await bytes(next)).toEqual([137, 80, 78, 71, 4]);
    expect(await bytes(id)).toBeNull();
    expect(
      await bytes((await db.settings.get(SETTINGS_ID))?.signatureBlobId),
    ).toEqual([137, 80, 78, 71, 3]);
  });

  test("a memo can go back to my saved signature, or have none", async () => {
    await setMySignature(db, png(5));
    const memo = await newMemo();
    await setMemoSignature(db, memo.id, png(6));
    const mine = await setMemoSignature(db, memo.id, "mine");
    expect(await bytes(mine)).toEqual([137, 80, 78, 71, 5]);

    expect(await setMemoSignature(db, memo.id, null)).toBeNull();
    expect((await db.memos.get(memo.id))?.signatureBlobId).toBeNull();
    expect(await db.blobs.count()).toBe(1); // only mine is left
  });

  test("deleting the inspection deletes its memo's signature", async () => {
    await setMySignature(db, png(7));
    const memo = await newMemo();
    await deleteInspection(db, memo.inspectionId);
    expect(await bytes(memo.signatureBlobId)).toBeNull();
    expect(await db.blobs.count()).toBe(1);
  });
});
