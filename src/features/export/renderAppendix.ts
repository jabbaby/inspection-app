/**
 * Draws the photo appendix pages (A4, 2 x 2 photos) with the memo's fonts
 * and footer (SPEC section 7).
 */
import { rgb, type Color, type PDFDocument, type PDFImage } from "pdf-lib";
import { northrop } from "../../brand/northrop";
import type { Photo } from "../../db/types";
import { drawFooter, type MemoFonts } from "../memo/pdf/renderMemoPdf";
import { toEncodable, wrapText } from "../memo/pdf/text";
import { PHOTOS_PER_ROW, fitPhoto, type AppendixPage } from "./appendixLayout";

const PAGE_W = northrop.page.width;
const PAGE_H = northrop.page.height;

/* Distances from the top of the page, in points. */
const MARGIN_X = 42;
const HEADER = { baseline: 52.7, size: 9, ruleTop: 60 };
const GRID_TOP = 74;
const ROW_HEIGHT = 362;
const GAP_X = 16;
const CELL_W = (PAGE_W - 2 * MARGIN_X - GAP_X) / PHOTOS_PER_ROW;
const HEADING = { size: 10.5, pitch: 13, lines: 2, height: 32 };
const PHOTO_H = 276;
const CAPTION = { size: 8.5, pitch: 11, lines: 3, gap: 14 };

function hex(colour: string): Color {
  const n = parseInt(colour.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const GREY = hex(northrop.colours.grey);
const MAROON = hex(northrop.colours.maroon);
const RULE = hex(northrop.colours.rule);

export interface AppendixInput {
  pages: AppendixPage[];
  /** "SIM-001 – Level 3 slab reinforcement" (top left of every page). */
  title: string;
  /** Page number of the first appendix page in the pack. */
  firstPageNumber: number;
  fonts: MemoFonts;
  icon: PDFImage;
  /** A photo's working copy (JPEG, or PNG). */
  loadPhoto: (photo: Photo) => Promise<{ data: Uint8Array; type: string }>;
  onPage?: (done: number, total: number) => void;
}

/** Wraps to at most `lines` lines, ending the last with "…" if cut. */
function clampLines(
  text: string,
  font: MemoFonts[keyof MemoFonts],
  size: number,
  width: number,
  lines: number,
): string[] {
  const wrapped = wrapText(toEncodable(text, font), font, size, width);
  if (wrapped.length <= lines) return wrapped;
  const kept = wrapped.slice(0, lines);
  let last = kept[lines - 1];
  while (last && font.widthOfTextAtSize(`${last}…`, size) > width)
    last = last.slice(0, -1);
  kept[lines - 1] = `${last.trimEnd()}…`;
  return kept;
}

/** Appends the appendix pages to `doc`. Returns how many were added. */
export async function appendPhotoAppendix(
  doc: PDFDocument,
  input: AppendixInput,
): Promise<number> {
  const { fonts } = input;
  for (const [index, layout] of input.pages.entries()) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const text = (
      value: string,
      x: number,
      baseline: number,
      font: MemoFonts[keyof MemoFonts],
      size: number,
      color: Color = GREY,
    ) => {
      const safe = toEncodable(value, font);
      if (safe)
        page.drawText(safe, { x, y: PAGE_H - baseline, font, size, color });
    };

    // Header: the memo reference on the left, "Photo appendix" on the right.
    const [title] = clampLines(
      input.title,
      fonts.semiBold,
      HEADER.size,
      PAGE_W - 2 * MARGIN_X - 90,
      1,
    );
    text(title, MARGIN_X, HEADER.baseline, fonts.semiBold, HEADER.size, MAROON);
    const right = "Photo appendix";
    text(
      right,
      PAGE_W - MARGIN_X - fonts.regular.widthOfTextAtSize(right, HEADER.size),
      HEADER.baseline,
      fonts.regular,
      HEADER.size,
    );
    page.drawLine({
      start: { x: MARGIN_X, y: PAGE_H - HEADER.ruleTop },
      end: { x: PAGE_W - MARGIN_X, y: PAGE_H - HEADER.ruleTop },
      thickness: 0.75,
      color: RULE,
    });

    for (const [r, row] of layout.rows.entries()) {
      const top = GRID_TOP + r * ROW_HEIGHT;
      if (row.heading) {
        clampLines(
          row.heading,
          fonts.bold,
          HEADING.size,
          PAGE_W - 2 * MARGIN_X,
          HEADING.lines,
        ).forEach((line, i) =>
          text(
            line,
            MARGIN_X,
            top + HEADING.size + i * HEADING.pitch,
            fonts.bold,
            HEADING.size,
          ),
        );
      }
      const photoTop = top + HEADING.height;
      for (const [c, entry] of row.photos.entries()) {
        const left = MARGIN_X + c * (CELL_W + GAP_X);
        const { data, type } = await input.loadPhoto(entry.photo);
        const image =
          type === "image/png"
            ? await doc.embedPng(data)
            : await doc.embedJpg(data);
        const size = fitPhoto(image, { width: CELL_W, height: PHOTO_H });
        page.drawImage(image, {
          x: left,
          y: PAGE_H - photoTop - size.height,
          ...size,
        });

        // "Photo IA1 – caption" just under the photo: label bold, caption regular.
        const caption = entry.photo.caption?.trim();
        const baseline = photoTop + size.height + CAPTION.gap;
        text(entry.label, left, baseline, fonts.bold, CAPTION.size);
        if (caption) {
          const lead = fonts.bold.widthOfTextAtSize(
            `${entry.label} `,
            CAPTION.size,
          );
          const lines = clampLines(
            `– ${caption}`,
            fonts.regular,
            CAPTION.size,
            CELL_W - lead,
            CAPTION.lines,
          );
          lines.forEach((line, i) =>
            text(
              line,
              left + lead,
              baseline + i * CAPTION.pitch,
              fonts.regular,
              CAPTION.size,
            ),
          );
        }
      }
    }

    drawFooter(page, input.firstPageNumber + index, fonts, input.icon);
    input.onPage?.(index + 1, input.pages.length);
  }
  return input.pages.length;
}
