/**
 * Record types stored in IndexedDB (SPEC section 8). Ids are UUID strings.
 * File bytes (PDFs, photos) live in the `blobs` table and are referenced by id.
 */

export interface Client {
  name: string;
  company: string;
  address1: string;
  address2: string;
}

export interface Inspection {
  id: string;
  jobNumber: string;
  jobName: string;
  /** e.g. "Level 3 slab reinforcement". Prefills the memo and heads the observations box. */
  itemInspected: string;
  client: Client;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  inspector: string;
  /** Workflow status. Values are settled in build step 4 (inspection CRUD). */
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface Drawing {
  id: string;
  inspectionId: string;
  name: string;
  pdfBlobId: string;
  pageCount: number;
  /** PDF size in bytes (kept here so listing drawings never loads the file). */
  fileSize: number;
  /**
   * Each page's [width, height] in points, so the whole inspection document
   * can be laid out without loading every PDF. Filled on upload, or the first
   * time the document is opened for drawings added before this existed.
   */
  pageSizes?: [number, number][];
  /** Drawings appear in the document in the order they were added. */
  createdAt: number;
}

export type ItemKind = "instruction" | "observation";

export interface Item {
  id: string;
  inspectionId: string;
  /**
   * A, B ... Z, AA ... per kind across the inspection, in pin creation
   * order with no gaps (instruction A and observation A can both exist).
   */
  letter: string;
  kind: ItemKind;
  drawingId: string;
  /** 1-based page number in the drawing PDF. */
  page: number;
  /** Normalised page coordinates (0..1), never screen pixels. */
  x: number;
  y: number;
  text: string;
  /** Only meaningful for instructions. */
  requiresPhotoConfirmation: boolean;
  photoIds: string[];
  createdAt: number;
}

export interface Photo {
  id: string;
  blobId: string;
  caption?: string;
  takenAt: number;
  width: number;
  height: number;
}

/**
 * File bytes. Stored as an ArrayBuffer, not a Blob: Blob storage in
 * IndexedDB is not supported by every WebKit build, ArrayBuffers are.
 */
export interface StoredBlob {
  id: string;
  data: ArrayBuffer;
  /** MIME type, e.g. "application/pdf". */
  type: string;
  size: number;
}

export type SentVia = "Aconex" | "Email";

export interface Recipient {
  company: string;
  attn: string;
  to: boolean;
  copy: boolean;
}

/** Per-job memo fields (SPEC section 4). Wired up in build step 7. */
export interface MemoFields {
  clientName: string;
  clientCompany: string;
  address1: string;
  address2: string;
  date: string;
  jobNumber: string;
  jobName: string;
  recipients: Recipient[];
  siteVisitRequestedBy: string;
  reasonForVisit: string;
  inspector: string;
  sentVia: SentVia;
  salutation: string;
  itemInspected: string;
  signOffName: string;
  signOffTitle: string;
}

export interface MemoBlock {
  /** Snippet or item this block came from, if any. */
  sourceId?: string;
  text: string;
}

export interface Memo {
  id: string;
  inspectionId: string;
  templateId: string;
  /** SIM-NNN, per job number (SPEC 7a). Editable. */
  reference: string;
  fields: MemoFields;
  bodyBlocks: MemoBlock[];
  conditionBlocks: MemoBlock[];
  updatedAt: number;
}

export interface MemoCounter {
  jobNumber: string;
  lastSeq: number;
}

export interface MemoTemplate {
  id: string;
  name: string;
  branding: {
    colours: Record<string, string>;
    logoBlobId?: string;
    fonts: string[];
  };
  fixedText: {
    disclaimer: string;
    officeBlock: string;
  };
}

export interface ObservationBox {
  id: string;
  drawingId: string;
  page: number;
  /** Normalised top-left (0..1). */
  x: number;
  y: number;
}

export type SnippetKind = "body" | "condition" | "heading";

export interface Snippet {
  id: string;
  kind: SnippetKind;
  label: string;
  text: string;
}

export const SETTINGS_ID = "app";

/** Single settings record, id `SETTINGS_ID`. */
export interface Settings {
  id: typeof SETTINGS_ID;
  inspectorName: string;
  inspectorTitle: string;
  defaultSentVia: SentVia;
  /** Set once the starter snippets have been seeded; they are never re-seeded. */
  snippetsSeeded: boolean;
  /** Result of the first-run navigator.storage.persist() request. */
  persistRequested?: { granted: boolean; at: number };
}
