import { touchInspection } from "./items";
import type { InspectionDb } from "./schema";
import { SETTINGS_ID, type StoredBlob } from "./types";

function pngBlob(png: Uint8Array): StoredBlob {
  const data = png.slice().buffer;
  return { id: crypto.randomUUID(), data, type: "image/png", size: png.length };
}

/** Saves my signature in Settings (used by memos created from now on). */
export async function setMySignature(
  db: InspectionDb,
  png: Uint8Array,
): Promise<void> {
  await db.transaction("rw", [db.settings, db.blobs], async () => {
    const settings = await db.settings.get(SETTINGS_ID);
    if (!settings) throw new Error("Settings not found");
    const blob = pngBlob(png);
    await db.blobs.add(blob);
    if (settings.signatureBlobId)
      await db.blobs.delete(settings.signatureBlobId);
    await db.settings.update(SETTINGS_ID, { signatureBlobId: blob.id });
  });
}

/** Removes my signature from Settings. Memos keep their own copies. */
export async function clearMySignature(db: InspectionDb): Promise<void> {
  await db.transaction("rw", [db.settings, db.blobs], async () => {
    const settings = await db.settings.get(SETTINGS_ID);
    if (settings?.signatureBlobId)
      await db.blobs.delete(settings.signatureBlobId);
    await db.settings.update(SETTINGS_ID, { signatureBlobId: null });
  });
}

/**
 * Gives a memo a new signature (`png`), or a copy of my saved one
 * (`"mine"`), or none (`null`). With no signature saved in Settings yet, a
 * new one is saved there too, so the next memo starts with it. Returns the
 * memo's new signature blob id.
 */
export async function setMemoSignature(
  db: InspectionDb,
  memoId: string,
  source: Uint8Array | "mine" | null,
  now = Date.now(),
): Promise<string | null> {
  return db.transaction(
    "rw",
    [db.memos, db.settings, db.blobs, db.inspections],
    async () => {
      const memo = await db.memos.get(memoId);
      if (!memo) throw new Error(`Memo ${memoId} not found`);
      const settings = await db.settings.get(SETTINGS_ID);

      let blob: StoredBlob | null = null;
      if (source === "mine") {
        const mine = settings?.signatureBlobId
          ? await db.blobs.get(settings.signatureBlobId)
          : undefined;
        if (!mine) throw new Error("No saved signature");
        blob = { ...mine, id: crypto.randomUUID() };
      } else if (source) {
        blob = pngBlob(source);
        if (settings && !settings.signatureBlobId) {
          const copy = { ...blob, id: crypto.randomUUID() };
          await db.blobs.add(copy);
          await db.settings.update(SETTINGS_ID, { signatureBlobId: copy.id });
        }
      }

      if (blob) await db.blobs.add(blob);
      if (memo.signatureBlobId) await db.blobs.delete(memo.signatureBlobId);
      const signatureBlobId = blob?.id ?? null;
      await db.memos.update(memoId, {
        signatureBlobId,
        // A new signature is meant to be shown.
        ...(blob ? { includeSignature: true } : {}),
        updatedAt: now,
      });
      await touchInspection(db, memo.inspectionId, now);
      return signatureBlobId;
    },
  );
}
