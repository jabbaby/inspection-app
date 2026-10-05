/**
 * The inspection file (SPEC section 9): a zip with inspection.json (the
 * records and a schemaVersion), drawings/ (original PDFs), photos/
 * (working copies), originals/ (camera originals, if included) and
 * signature/ (the memo's signature). Uses fflate (bundled, offline).
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import {
  SCHEMA_VERSION,
  type CollectedInspection,
  type InspectionData,
} from "../../db/backup";
import { sanitise } from "../memo/memoFilename";

const DATA = "inspection.json";
export const FILE_EXTENSION = ".inspection";
export const FILE_TYPE = "application/zip";

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Where each stored file goes in the zip, by what refers to it. */
function blobPaths(data: InspectionData): Map<string, string> {
  const folder = new Map<string, string>();
  for (const d of data.drawings) folder.set(d.pdfBlobId, "drawings");
  for (const p of data.photos) {
    folder.set(p.blobId, "photos");
    if (p.originalBlobId) folder.set(p.originalBlobId, "originals");
  }
  if (data.memo?.signatureBlobId)
    folder.set(data.memo.signatureBlobId, "signature");
  return new Map(
    data.blobs.map((b) => [
      b.id,
      `${folder.get(b.id) ?? "files"}/${b.id}.${EXTENSIONS[b.type] ?? "bin"}`,
    ]),
  );
}

/** The zip's bytes. PDFs and JPEGs are stored as they are (already compressed). */
export function packInspection(collected: CollectedInspection): Uint8Array {
  const { data, blobs } = collected;
  const paths = blobPaths(data);
  const files: Zippable = {
    [DATA]: [strToU8(JSON.stringify(data)), { level: 6 }],
  };
  for (const blob of blobs)
    files[paths.get(blob.id)!] = [new Uint8Array(blob.data), { level: 0 }];
  return zipSync(files);
}

/** A file this build can't read, with a message to show. */
export class InspectionFileError extends Error {}

/** Reads an inspection file: its data and stored files (by id). */
export function unpackInspection(bytes: Uint8Array): {
  data: InspectionData;
  blobs: Map<string, Uint8Array>;
} {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new InspectionFileError("This isn't an inspection file.");
  }
  const json = entries[DATA];
  if (!json) throw new InspectionFileError("This isn't an inspection file.");
  let data: InspectionData;
  try {
    data = JSON.parse(strFromU8(json)) as InspectionData;
  } catch {
    throw new InspectionFileError("This inspection file is damaged.");
  }
  if (
    typeof data?.schemaVersion !== "number" ||
    typeof data.inspection?.id !== "string" ||
    !Array.isArray(data.drawings) ||
    !Array.isArray(data.items) ||
    !Array.isArray(data.blobs)
  )
    throw new InspectionFileError("This inspection file is damaged.");
  if (data.schemaVersion > SCHEMA_VERSION)
    throw new InspectionFileError(
      "This file was made by a newer version of the app. Update the app (close and reopen it), then try again.",
    );
  const paths = blobPaths(data);
  const blobs = new Map<string, Uint8Array>();
  for (const meta of data.blobs) {
    const entry = entries[paths.get(meta.id)!];
    if (entry) blobs.set(meta.id, entry);
  }
  return { data, blobs };
}

/** "SY000001_Level-3-slab-reinforcement_2026-10-05.inspection". */
export function inspectionFilename(
  jobNumber: string,
  itemInspected: string,
  isoDate: string,
): string {
  const base =
    [jobNumber, itemInspected || "inspection", isoDate]
      .map(sanitise)
      .filter(Boolean)
      .join("_")
      .slice(0, 120) || "inspection";
  return `${base}${FILE_EXTENSION}`;
}
