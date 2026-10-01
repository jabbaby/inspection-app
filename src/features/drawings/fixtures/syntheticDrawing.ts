// Synthetic structural-style drawings for testing the viewer. No real project
// content. Used by the Spike B screen (generated on the device, so nothing
// large is committed or downloaded) and by `npm run fixtures:drawings`.
import {
  LineCapStyle,
  PDFDocument,
  StandardFonts,
  closePath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setLineCap,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

export type SheetSize = "A1" | "A3" | "A4";

/** Sheet sizes in points: A1 and A3 landscape, A4 portrait. */
export const SHEET_SIZES: Record<SheetSize, [number, number]> = {
  A1: [2383.94, 1683.78],
  A3: [1190.55, 841.89],
  A4: [595.28, 841.89],
};

export interface SheetSpec {
  size: SheetSize;
  number: string;
  title: string;
  /** Extra short line segments (rebar/hatch) to make the sheet heavy. */
  extraLines?: number;
  /** JPEG drawn as a large underlay, to test raster-heavy sheets. */
  rasterJpeg?: Uint8Array;
}

export const TYPICAL_DRAWING: SheetSpec[] = [
  { size: "A1", number: "S-101", title: "LEVEL 3 SLAB PLAN" },
  { size: "A3", number: "S-501", title: "TYPICAL DETAILS" },
  { size: "A4", number: "S-001", title: "GENERAL NOTES" },
];

export const HEAVY_DRAWING: SheetSpec[] = [
  {
    size: "A1",
    number: "S-102",
    title: "LEVEL 4 SLAB REINFORCEMENT PLAN",
    extraLines: 60_000,
  },
];

const BLACK = rgb(0, 0, 0);
const GRID = rgb(0.45, 0.45, 0.45);

/** Small deterministic PRNG so fixtures are identical on every run. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function drawSheet(page: PDFPage, spec: SheetSpec, font: PDFFont, bold: PDFFont) {
  const { width, height } = page.getSize();
  const k = width / SHEET_SIZES.A1[0]; // scale relative to A1
  const unit = Math.max(k, 0.3);
  const margin = 28 * unit;

  // Border.
  page.drawRectangle({
    x: margin,
    y: margin,
    width: width - 2 * margin,
    height: height - 2 * margin,
    borderColor: BLACK,
    borderWidth: 1.5 * unit,
  });

  // Title block, bottom right.
  const tbW = 520 * unit;
  const tbH = 190 * unit;
  const tbX = width - margin - tbW;
  const tbY = margin;
  page.drawRectangle({
    x: tbX,
    y: tbY,
    width: tbW,
    height: tbH,
    borderColor: BLACK,
    borderWidth: 1.2 * unit,
  });
  const rows = [
    ["PROJECT", "EXAMPLE APARTMENTS (SYNTHETIC)"],
    ["DRAWING", spec.title],
    ["DRAWING NO.", `${spec.number}   SHEET ${spec.size}`],
    ["STATUS", "SYNTHETIC TEST DRAWING – NOT FOR CONSTRUCTION"],
  ];
  rows.forEach(([label, value], i) => {
    const rowY = tbY + tbH - (i + 1) * (tbH / rows.length);
    if (i > 0) {
      page.drawLine({
        start: { x: tbX, y: rowY + tbH / rows.length },
        end: { x: tbX + tbW, y: rowY + tbH / rows.length },
        thickness: 0.6 * unit,
        color: BLACK,
      });
    }
    page.drawText(label, { x: tbX + 10 * unit, y: rowY + 28 * unit, size: 10 * unit, font });
    page.drawText(value, {
      x: tbX + 120 * unit,
      y: rowY + 24 * unit,
      size: 14 * unit,
      font: bold,
      maxWidth: tbW - 130 * unit,
    });
  });

  // Drawing area above/left of the title block.
  const areaX = margin + 120 * unit;
  const areaY = margin + tbH + 80 * unit;
  const areaW = width - 2 * margin - 240 * unit;
  const areaH = height - areaY - margin - 120 * unit;

  if (spec.rasterJpeg) return; // raster underlay drawn by the caller

  // Grid lines with bubbles: letters across, numbers down.
  const cols = spec.size === "A4" ? 3 : 8;
  const rowsN = spec.size === "A4" ? 4 : 6;
  const bubble = 18 * unit;
  for (let c = 0; c < cols; c++) {
    const x = areaX + (areaW * c) / (cols - 1);
    page.drawLine({
      start: { x, y: areaY },
      end: { x, y: areaY + areaH },
      thickness: 0.5 * unit,
      color: GRID,
      dashArray: [24 * unit, 6 * unit, 4 * unit, 6 * unit],
    });
    page.drawCircle({
      x,
      y: areaY + areaH + bubble + 6 * unit,
      size: bubble,
      borderColor: BLACK,
      borderWidth: unit,
    });
    const label = String.fromCharCode(65 + c);
    page.drawText(label, {
      x: x - bold.widthOfTextAtSize(label, 18 * unit) / 2,
      y: areaY + areaH + bubble,
      size: 18 * unit,
      font: bold,
    });
  }
  for (let r = 0; r < rowsN; r++) {
    const y = areaY + (areaH * r) / (rowsN - 1);
    page.drawLine({
      start: { x: areaX, y },
      end: { x: areaX + areaW, y },
      thickness: 0.5 * unit,
      color: GRID,
      dashArray: [24 * unit, 6 * unit, 4 * unit, 6 * unit],
    });
    page.drawCircle({
      x: areaX - bubble - 6 * unit,
      y,
      size: bubble,
      borderColor: BLACK,
      borderWidth: unit,
    });
    const label = String(rowsN - r);
    page.drawText(label, {
      x: areaX - bubble - 6 * unit - bold.widthOfTextAtSize(label, 18 * unit) / 2,
      y: y - 6 * unit,
      size: 18 * unit,
      font: bold,
    });
  }

  // Slab edge and columns at every grid intersection.
  page.drawRectangle({
    x: areaX - 40 * unit,
    y: areaY - 40 * unit,
    width: areaW + 80 * unit,
    height: areaH + 80 * unit,
    borderColor: BLACK,
    borderWidth: 2.5 * unit,
  });
  const col = 22 * unit;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rowsN; r++) {
      page.drawRectangle({
        x: areaX + (areaW * c) / (cols - 1) - col / 2,
        y: areaY + (areaH * r) / (rowsN - 1) - col / 2,
        width: col,
        height: col,
        color: BLACK,
      });
    }
  }

  // Small annotation text so zoomed-in sharpness is easy to judge.
  const rand = random(spec.number.length * 97 + cols);
  for (let i = 0; i < 40; i++) {
    page.drawText(`N12-${200 + Math.floor(rand() * 4) * 50} T&B  (SYN-${i + 1})`, {
      x: areaX + rand() * (areaW - 150 * unit),
      y: areaY + rand() * areaH,
      size: 6 * unit,
      font,
      color: rgb(0.1, 0.1, 0.5),
    });
  }

  // Notes block, top left.
  const notes = [
    "NOTES:",
    "1. THIS IS A SYNTHETIC TEST DRAWING GENERATED FOR SOFTWARE TESTING.",
    "2. IT DOES NOT DESCRIBE ANY REAL STRUCTURE. NOT FOR CONSTRUCTION.",
    "3. GRID, COLUMN AND TEXT CONTENT IS ARBITRARY.",
  ];
  notes.forEach((line, i) => {
    page.drawText(line, {
      x: margin + 20 * unit,
      y: height - margin - (30 + i * 16) * unit,
      size: (i === 0 ? 12 : 9) * unit,
      font: i === 0 ? bold : font,
    });
  });

  if (spec.extraLines) {
    drawManyLines(page, spec.extraLines, areaX, areaY, areaW, areaH, unit, rand);
  }
}

/** Writes many short segments as raw path operators (fast for large counts). */
function drawManyLines(
  page: PDFPage,
  count: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  unit: number,
  rand: () => number,
) {
  const ops = [
    pushGraphicsState(),
    setStrokingRgbColor(0.75, 0.1, 0.1),
    setLineWidth(0.35 * unit),
    setLineCap(LineCapStyle.Round),
  ];
  for (let i = 0; i < count; i++) {
    const x = x0 + rand() * w;
    const y = y0 + rand() * h;
    const horizontal = rand() < 0.5;
    const len = (20 + rand() * 120) * unit;
    ops.push(moveTo(x, y));
    ops.push(horizontal ? lineTo(Math.min(x + len, x0 + w), y) : lineTo(x, Math.min(y + len, y0 + h)));
    if (i % 500 === 499) ops.push(stroke());
  }
  ops.push(closePath(), stroke(), popGraphicsState());
  // Push in chunks: spreading ~100k operators at once overflows the stack.
  for (let i = 0; i < ops.length; i += 5000) {
    page.pushOperators(...ops.slice(i, i + 5000));
  }
}

export async function buildSyntheticDrawing(sheets: SheetSpec[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Synthetic test drawing");
  doc.setCreator("Site Inspection Companion (fixture generator)");
  // Standard fonts are not embedded, as in many CAD exports, so this also
  // exercises pdf.js's bundled standard font data.
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const spec of sheets) {
    const page = doc.addPage(SHEET_SIZES[spec.size]);
    if (spec.rasterJpeg) {
      const image = await doc.embedJpg(spec.rasterJpeg);
      const { width, height } = page.getSize();
      page.drawImage(image, { x: 60, y: 260, width: width - 120, height: height - 320 });
    }
    drawSheet(page, spec, font, bold);
  }
  return doc.save();
}
