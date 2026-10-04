/**
 * The export pack's marked-up drawing pages (SPEC section 7): every page
 * with pins, in document order, each the original PDF page at its own size
 * with the pins, arrows and notes box burned in. Hidden pages are left out;
 * a duplicated page with pins exports as its own page.
 */
import { PDFDocument } from "pdf-lib";
import type { Drawing, Item, ObservationBox } from "../../db/types";
import { compareItems } from "../items/letters";
import { boxLines } from "../drawings/observationBox";
import { drawPageMarkup, type MarkupFonts } from "./drawMarkup";

export interface PinnedPage {
  drawing: Drawing;
  /** 1-based position in Drawing.pages (what items refer to). */
  position: number;
  /** 1-based page of the drawing's PDF it shows. */
  source: number;
  /** Its items, observations then instructions, each in letter order. */
  items: Item[];
}

/** The pages that go in the pack, in document order. */
export function pinnedPages(drawings: Drawing[], items: Item[]): PinnedPage[] {
  return drawings.flatMap((drawing) =>
    drawing.pages.flatMap((entry, i) => {
      const position = i + 1;
      if (entry.hidden) return [];
      const onPage = items
        .filter((it) => it.drawingId === drawing.id && it.page === position)
        .sort(compareItems);
      return onPage.length > 0
        ? [{ drawing, position, source: entry.source, items: onPage }]
        : [];
    }),
  );
}

export interface DrawingPagesInput {
  pages: PinnedPage[];
  boxes: ObservationBox[];
  /** boxHeader() for the inspection. */
  header: string;
  /** The notes box's observations heading (a heading snippet). */
  observationHeading: string;
  /** A drawing's PDF bytes (loaded one drawing at a time). */
  loadPdf: (drawing: Drawing) => Promise<Uint8Array>;
  /** Called after each page is added. */
  onPage?: (done: number, total: number) => void;
}

/** Thrown when a drawing's PDF can't be read for the pack. */
export class DrawingReadError extends Error {
  readonly drawingName: string;
  constructor(drawingName: string, cause: unknown) {
    super(`Couldn't read the drawing "${drawingName}"`, { cause });
    this.drawingName = drawingName;
  }
}

/** Appends the pinned pages to `doc`. Returns how many were added. */
export async function appendDrawingPages(
  doc: PDFDocument,
  input: DrawingPagesInput,
  fonts: MarkupFonts,
): Promise<number> {
  const total = input.pages.length;
  let done = 0;
  // Group by drawing, keeping document order, so each PDF is opened once.
  const byDrawing: PinnedPage[][] = [];
  for (const page of input.pages) {
    const last = byDrawing[byDrawing.length - 1];
    if (last && last[0].drawing.id === page.drawing.id) last.push(page);
    else byDrawing.push([page]);
  }
  for (const group of byDrawing) {
    const drawing = group[0].drawing;
    let source: PDFDocument;
    try {
      source = await PDFDocument.load(await input.loadPdf(drawing), {
        ignoreEncryption: true,
        updateMetadata: false,
      });
    } catch (e) {
      throw new DrawingReadError(drawing.name, e);
    }
    const copied = await doc.copyPages(
      source,
      group.map((p) => p.source - 1),
    );
    group.forEach((pinned, i) => {
      const page = doc.addPage(copied[i]);
      const box = input.boxes.find(
        (b) => b.drawingId === drawing.id && b.page === pinned.position,
      );
      drawPageMarkup(
        page,
        {
          items: pinned.items,
          box: box ? { x: box.x, y: box.y } : null,
          boxLines: boxLines({
            header: input.header,
            observationHeading: input.observationHeading,
            items: pinned.items,
          }),
        },
        fonts,
      );
      done += 1;
      input.onPage?.(done, total);
    });
  }
  return done;
}
