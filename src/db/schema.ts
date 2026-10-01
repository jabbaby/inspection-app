import { Dexie, type EntityTable } from "dexie";
import { indexForLetter } from "../features/items/letters";
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
export const SCHEMA_VERSION = 3;

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
    // v2: inspections gain itemInspected and the letter counter. Existing
    // inspections continue after their highest letter so none is reused.
    this.version(2).upgrade(async (tx) => {
      const highest = new Map<string, number>();
      await tx.table<Item>("items").each((item) => {
        const index = indexForLetter(item.letter);
        highest.set(
          item.inspectionId,
          Math.max(highest.get(item.inspectionId) ?? -1, index),
        );
      });
      await tx
        .table<Inspection>("inspections")
        .toCollection()
        .modify((inspection) => {
          inspection.itemInspected ??= "";
          inspection.nextLetterIndex ??= (highest.get(inspection.id) ?? -1) + 1;
        });
    });
    // v3: drawings gain createdAt (document order). Page sizes are filled in
    // lazily by the app, as they need the PDF.
    this.version(3).upgrade(async (tx) => {
      let order = 0;
      const base = Date.now();
      await tx
        .table<Drawing>("drawings")
        .toCollection()
        .modify((drawing) => {
          drawing.createdAt ??= base + order++;
        });
    });
  }
}
