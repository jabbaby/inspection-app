import { Dexie, type EntityTable } from "dexie";
import type {
  Drawing,
  Inspection,
  Item,
  Memo,
  MemoCounter,
  MemoTemplate,
  ObservationBox,
  Photo,
  Settings,
  Snippet,
  StoredBlob,
} from "./types";

/**
 * Version of the inspection data format. The inspection file (SPEC section 9)
 * writes this as `schemaVersion`; bump it when stored records change shape.
 */
export const SCHEMA_VERSION = 1;

export const DB_NAME = "inspection-app";

// Calculations (slice 3) go in a separate Dexie database
// ("inspection-app-calcs"), never in this one, so they can never end up in
// an inspection file or PDF pack.

export class InspectionDb extends Dexie {
  inspections!: EntityTable<Inspection, "id">;
  drawings!: EntityTable<Drawing, "id">;
  items!: EntityTable<Item, "id">;
  photos!: EntityTable<Photo, "id">;
  blobs!: EntityTable<StoredBlob, "id">;
  memos!: EntityTable<Memo, "id">;
  memoCounters!: EntityTable<MemoCounter, "jobNumber">;
  memoTemplates!: EntityTable<MemoTemplate, "id">;
  snippets!: EntityTable<Snippet, "id">;
  settings!: EntityTable<Settings, "id">;
  observationBoxes!: EntityTable<ObservationBox, "id">;

  constructor(name = DB_NAME) {
    super(name);
    // Only indexed fields are listed; other fields are stored as-is.
    this.version(1).stores({
      inspections: "id, jobNumber, updatedAt",
      drawings: "id, inspectionId",
      items: "id, inspectionId, [inspectionId+letter], drawingId",
      photos: "id",
      blobs: "id",
      memos: "id, inspectionId",
      memoCounters: "jobNumber",
      memoTemplates: "id",
      snippets: "id, kind",
      settings: "id",
      observationBoxes: "id, [drawingId+page]",
    });
  }
}
