import type { UpdateSpec } from "dexie";
import { todayIso } from "../lib/dates";
import type { InspectionDb } from "./schema";
import {
  SETTINGS_ID,
  photoBlobIds,
  type Client,
  type Inspection,
} from "./types";

/** Fields the job details form edits. Client fields are merged, not replaced. */
export interface InspectionPatch {
  jobNumber?: string;
  jobName?: string;
  itemInspected?: string;
  date?: string;
  inspector?: string;
  client?: Partial<Client>;
}

/** Job fields a memo needs (SIM reference and filename depend on them). */
export type RequiredJobField = "jobNumber" | "jobName";

export function emptyClient(): Client {
  return { name: "", company: "", address1: "", address2: "" };
}

/**
 * Creates a draft inspection dated today, with the inspector taken from
 * Settings. Nothing is required up front: details can be filled in later.
 */
export async function createInspection(
  db: InspectionDb,
  now: Date = new Date(),
): Promise<Inspection> {
  const settings = await db.settings.get(SETTINGS_ID);
  const inspection: Inspection = {
    id: crypto.randomUUID(),
    jobNumber: "",
    jobName: "",
    itemInspected: "",
    client: emptyClient(),
    date: todayIso(now),
    inspector: settings?.inspectorName ?? "",
    status: "draft",
    photoIds: [],
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
  await db.inspections.add(inspection);
  return inspection;
}

/** Saves changed fields and bumps updatedAt. Client fields are merged. */
export async function updateInspection(
  db: InspectionDb,
  id: string,
  patch: InspectionPatch,
  now: number = Date.now(),
): Promise<void> {
  const { client, ...top } = patch;
  const changes: Record<string, unknown> = { ...top, updatedAt: now };
  // Dotted key paths update one client field without overwriting the others.
  for (const [key, value] of Object.entries(client ?? {})) {
    changes[`client.${key}`] = value;
  }
  const updated = await db.inspections.update(
    id,
    changes as UpdateSpec<Inspection>,
  );
  if (updated === 0) throw new Error(`Inspection ${id} not found`);
}

/**
 * Deletes an inspection and everything that belongs to it: drawings and
 * their PDFs, items, photos and their images, observation boxes and memos
 * (with their signatures).
 * Runs in one transaction so it either all goes or nothing does. Memo
 * counters are kept: they belong to the job number, so SIM references are
 * never reused.
 */
export async function deleteInspection(
  db: InspectionDb,
  id: string,
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.inspections,
      db.drawings,
      db.items,
      db.photos,
      db.blobs,
      db.observationBoxes,
      db.memos,
    ],
    async () => {
      const drawings = await db.drawings
        .where("inspectionId")
        .equals(id)
        .toArray();
      const items = await db.items.where("inspectionId").equals(id).toArray();
      const inspection = await db.inspections.get(id);
      const photoIds = [
        ...items.flatMap((item) => item.photoIds),
        ...(inspection?.photoIds ?? []),
      ];
      const photos = (await db.photos.bulkGet(photoIds)).filter(
        (p) => p !== undefined,
      );
      const drawingIds = drawings.map((d) => d.id);
      const memos = await db.memos.where("inspectionId").equals(id).toArray();

      await db.blobs.bulkDelete([
        ...drawings.map((d) => d.pdfBlobId),
        ...photos.flatMap(photoBlobIds),
        ...memos.flatMap((m) => (m.signatureBlobId ? [m.signatureBlobId] : [])),
      ]);
      await db.photos.bulkDelete(photoIds);
      await db.observationBoxes
        .filter((box) => drawingIds.includes(box.drawingId))
        .delete();
      await db.items.where("inspectionId").equals(id).delete();
      await db.drawings.where("inspectionId").equals(id).delete();
      await db.memos.where("inspectionId").equals(id).delete();
      await db.inspections.delete(id);
    },
  );
}

export function missingJobFields(inspection: Inspection): RequiredJobField[] {
  const missing: RequiredJobField[] = [];
  if (!inspection.jobNumber.trim()) missing.push("jobNumber");
  if (!inspection.jobName.trim()) missing.push("jobName");
  return missing;
}
