import { Dexie, type EntityTable } from "dexie";
import { indexForLetter } from "../features/items/letters";
import { emptyClient } from "./inspections";
import { letterChanges } from "./items";
import { mergeContacts } from "./projects";
import type {
  Client,
  Drawing,
  Inspection,
  Item,
  Markup,
  Memo,
  MemoCounter,
  MemoTemplate,
  ObservationBox,
  PageImage,
  Photo,
  Project,
  Settings,
  Snippet,
  StoredBlob,
} from "./types";

/**
 * Version of the inspection data format. The inspection file (SPEC section 9)
 * writes this as `schemaVersion`; bump it when stored records change shape.
 */
export const SCHEMA_VERSION = 10;

export const DB_NAME = "inspection-app";

// Calculations (slice 3) go in a separate Dexie database
// ("inspection-app-calcs"), never in this one, so they can never end up in
// an inspection file or PDF pack.

export class InspectionDb extends Dexie {
  projects!: EntityTable<Project, "id">;
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
  markups!: EntityTable<Markup, "id">;
  pageImages!: EntityTable<PageImage, "id">;

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
        .modify((inspection: Inspection & { nextLetterIndex?: number }) => {
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
    // v4: instructions and observations are lettered separately, so
    // letters are always derived from the items and the inspection's
    // letter counter goes.
    this.version(4).upgrade(async (tx) => {
      await tx
        .table<Inspection & { nextLetterIndex?: number }>("inspections")
        .toCollection()
        .modify((inspection) => {
          delete inspection.nextLetterIndex;
        });
    });
    // v5: letters follow document order (drawing, page, then placement on
    // the page), per kind. Re-letter existing items to match.
    this.version(5).upgrade(async (tx) => {
      // Items gain a sequence in v6; until then it's the creation order.
      const items = (await tx.table<Item>("items").toArray()).map((item) => ({
        ...item,
        sequence: item.sequence ?? item.createdAt,
      }));
      const drawings = await tx.table<Drawing>("drawings").toArray();
      drawings.sort((a, b) => a.createdAt - b.createdAt);
      const byInspection = new Map<string, Item[]>();
      for (const item of items)
        byInspection.set(item.inspectionId, [
          ...(byInspection.get(item.inspectionId) ?? []),
          item,
        ]);
      for (const [inspectionId, group] of byInspection) {
        const order = drawings
          .filter((d) => d.inspectionId === inspectionId)
          .map((d) => d.id);
        for (const { id, letter } of letterChanges(group, order))
          await tx.table<Item>("items").update(id, { letter });
      }
    });
    // v6: items gain a sequence (their order on the page) so they can be
    // reordered. It starts as the creation order, so no letters change.
    this.version(6).upgrade(async (tx) => {
      await tx
        .table<Item>("items")
        .toCollection()
        .modify((item) => {
          item.sequence ??= item.createdAt;
        });
    });
    // v7: items gain arrows (pointing from the pin to spots on its page).
    this.version(7).upgrade(async (tx) => {
      await tx
        .table<Item>("items")
        .toCollection()
        .modify((item) => {
          item.arrows ??= [];
        });
    });
    // v8: inspections gain general photos (not tied to a pin).
    this.version(8).upgrade(async (tx) => {
      await tx
        .table<Inspection>("inspections")
        .toCollection()
        .modify((inspection) => {
          inspection.photoIds ??= [];
        });
    });
    // v9: memos gain a signature (none until one is drawn or uploaded).
    this.version(9).upgrade(async (tx) => {
      await tx
        .table<Memo>("memos")
        .toCollection()
        .modify((memo) => {
          memo.signatureBlobId ??= null;
          memo.includeSignature ??= true;
        });
    });
    // v10: job details move from inspections to projects. Inspections with
    // the same job number share one project (the most recently edited one's
    // details win); its contacts are its memos' recipients. Inspections
    // with no job number aren't put in a project: they are flagged "Needs
    // a project" and keep their details to start one from.
    this.version(10)
      .stores({
        projects: "id, jobNumber, updatedAt",
        inspections: "id, projectId, updatedAt",
      })
      .upgrade(async (tx) => {
        type Legacy = Inspection & {
          jobNumber?: string;
          jobName?: string;
          client?: Client;
        };
        const inspections = await tx.table<Legacy>("inspections").toArray();
        const memos = await tx.table<Memo>("memos").toArray();
        const byJob = new Map<string, Legacy[]>();
        for (const inspection of inspections) {
          const jobNumber = inspection.jobNumber?.trim() ?? "";
          if (jobNumber)
            byJob.set(jobNumber, [...(byJob.get(jobNumber) ?? []), inspection]);
        }
        const projectFor = new Map<string, string>();
        for (const [jobNumber, group] of byJob) {
          const latest = group.reduce((a, b) =>
            b.updatedAt > a.updatedAt ? b : a,
          );
          const ids = new Set(group.map((i) => i.id));
          const contacts = mergeContacts(
            [],
            memos
              .filter((m) => ids.has(m.inspectionId))
              .flatMap((m) => m.recipients),
          );
          const project: Project = {
            id: crypto.randomUUID(),
            jobNumber,
            jobName: latest.jobName ?? "",
            client: { ...emptyClient(), ...latest.client },
            contacts,
            createdAt: Math.min(...group.map((i) => i.createdAt)),
            updatedAt: latest.updatedAt,
          };
          await tx.table<Project>("projects").add(project);
          for (const i of group) projectFor.set(i.id, project.id);
        }
        await tx
          .table<Legacy>("inspections")
          .toCollection()
          .modify((inspection) => {
            const projectId = projectFor.get(inspection.id) ?? null;
            const client = { ...emptyClient(), ...inspection.client };
            const jobName = inspection.jobName ?? "";
            inspection.projectId = projectId;
            if (
              !projectId &&
              (jobName.trim() || Object.values(client).some((v) => v.trim()))
            )
              inspection.unsorted = { jobName, client };
            delete inspection.jobNumber;
            delete inspection.jobName;
            delete inspection.client;
          });
      });
    // v11: drawings list their pages, so pages can be hidden or duplicated
    // (the Pages view). Each starts as its PDF page, so items and notes
    // boxes (which refer to a page by position) don't change.
    this.version(11).upgrade(async (tx) => {
      await tx
        .table<Drawing>("drawings")
        .toCollection()
        .modify((drawing) => {
          drawing.pages ??= Array.from(
            { length: drawing.pageCount },
            (_, i) => ({ source: i + 1 }),
          );
        });
    });
    // Slice 2: pen and highlighter marks, one record per mark.
    this.version(12).stores({
      markups: "id, inspectionId, drawingId",
    });
    // Step 10b: drawing pages' saved base images (PNG), shown at once.
    this.version(13).stores({
      pageImages: "id, drawingId",
    });
  }
}
