/**
 * Burns a drawing page's markup, pins, arrows and notes box into the PDF
 * page, the same size and place as the viewer draws them (SPEC sections 5,
 * 5a and 7).
 */
import {
  BlendMode,
  LineCapStyle,
  LineJoinStyle,
  concatTransformationMatrix,
  setLineJoin,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type Color,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { northrop } from "../../brand/northrop";
import type { Item, Markup } from "../../db/types";
import { arrowMetrics, arrowShape } from "../drawings/arrows";
import { defaultBoxPosition, type BoxLine } from "../drawings/observationBox";
import type { Point } from "../drawings/viewer/viewTransform";
import {
  SHAPE_FILL_OPACITY,
  drawMark,
  isFilled,
  markStyle,
} from "../markup/markGeometry";
import { toEncodable } from "../memo/pdf/text";
import { layoutNotesBox, pageView, pinMetrics } from "./markupGeometry";
import type { PagePin } from "./packContents";

export interface MarkupFonts {
  regular: PDFFont;
  bold: PDFFont;
}

export interface PageMarkup {
  /** Every pin on this page (copies included). */
  pins: PagePin[];
  /** Pen and highlighter marks, drawn first (under everything else). */
  marks: Markup[];
  /** The notes box's top-left, normalised on the page (null: default spot). */
  box: Point | null;
  /** From boxLines(): what the notes box says. */
  boxLines: BoxLine[];
}

function hex(colour: string): Color {
  const n = parseInt(colour.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const RED = hex(northrop.colours.red);
const BLUE = hex(northrop.markup.blue);
const HEADER = hex(northrop.markup.header);
const WHITE = rgb(1, 1, 1);

const kindColour = (kind: Item["kind"]) =>
  kind === "instruction" ? RED : BLUE;

/** Draws the markup over the page's own content. */
export function drawPageMarkup(
  page: PDFPage,
  markup: PageMarkup,
  fonts: MarkupFonts,
): void {
  const view = pageView(page.getCropBox(), page.getRotation().angle);
  const size = { width: view.width, height: view.height };
  // From here on, draw on the page as shown: origin bottom left, y up.
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(...view.matrix),
  );
  /** A normalised point (y down) in shown-page points (y up). */
  const at = (p: Point) => ({
    x: p.x * size.width,
    y: size.height - p.y * size.height,
  });

  drawMarks(page, markup.marks, size);
  // A page with only markup has no notes box (it lists the page's pins).
  if (markup.pins.length > 0) drawNotesBox(page, markup, size, fonts);

  const am = arrowMetrics(size);
  for (const item of markup.pins) {
    const colour = kindColour(item.kind);
    for (const arrow of item.arrows) {
      // arrowShape works in y-down page units; flip the result.
      const shape = arrowShape(
        { x: item.x * size.width, y: item.y * size.height },
        { x: arrow.x * size.width, y: arrow.y * size.height },
        size,
      );
      if (!shape) continue;
      const flip = (p: Point) => ({ x: p.x, y: size.height - p.y });
      const [a, b] = shape.line.map(flip);
      page.drawLine({
        start: a,
        end: b,
        thickness: am.strokeWidth,
        color: colour,
        lineCap: 1,
      });
      const head = shape.head;
      page.drawSvgPath(
        `M ${head[0].x} ${head[0].y} L ${head[1].x} ${head[1].y} L ${head[2].x} ${head[2].y} Z`,
        { x: 0, y: size.height, color: colour, borderWidth: 0 },
      );
    }
  }

  const pm = pinMetrics(size);
  for (const item of markup.pins) {
    const centre = at(item);
    page.drawCircle({
      ...centre,
      size: pm.radius,
      color: kindColour(item.kind),
      borderColor: WHITE,
      borderWidth: pm.borderWidth,
    });
    const letter = toEncodable(item.letter, fonts.bold);
    // Two letters (AA...) shrink to fit inside the circle.
    const fontSize = Math.min(
      pm.fontSize,
      (pm.radius * 1.5) / (fonts.bold.widthOfTextAtSize(letter, 1) || 1),
    );
    page.drawText(letter, {
      x: centre.x - fonts.bold.widthOfTextAtSize(letter, fontSize) / 2,
      y: centre.y - fonts.bold.heightAtSize(fontSize, { descender: false }) / 2,
      size: fontSize,
      font: fonts.bold,
      color: WHITE,
    });
  }

  page.pushOperators(popGraphicsState());
}

/** Marks as vector strokes, in the same smoothed shape as the viewer's. */
function drawMarks(
  page: PDFPage,
  marks: Markup[],
  size: { width: number; height: number },
) {
  if (marks.length === 0) return;
  // drawSvgPath sets no line join: round, like the viewer.
  page.pushOperators(pushGraphicsState(), setLineJoin(LineJoinStyle.Round));
  for (const mark of marks) {
    const style = markStyle(mark, size);
    const drawing = drawMark(mark, size);
    const colour = hex(style.colour);
    // y-down page units, flipped by drawing from the top-left corner.
    page.drawSvgPath(drawing.d, {
      x: 0,
      y: size.height,
      ...(isFilled(mark, drawing)
        ? { color: colour, opacity: SHAPE_FILL_OPACITY }
        : {}),
      borderColor: colour,
      borderWidth: style.width,
      borderOpacity: style.opacity,
      borderLineCap: LineCapStyle.Round,
      blendMode:
        mark.tool === "highlighter" ? BlendMode.Multiply : BlendMode.Normal,
    });
    if (drawing.head)
      page.drawSvgPath(drawing.head, {
        x: 0,
        y: size.height,
        color: colour,
        borderWidth: 0,
      });
  }
  page.pushOperators(popGraphicsState());
}

function drawNotesBox(
  page: PDFPage,
  markup: PageMarkup,
  size: { width: number; height: number },
  fonts: MarkupFonts,
) {
  const font = (bold: boolean) => (bold ? fonts.bold : fonts.regular);
  const layout = layoutNotesBox(markup.boxLines, size, (text, bold, s) =>
    font(bold).widthOfTextAtSize(toEncodable(text, font(bold)), s),
  );
  const box = markup.box ?? defaultBoxPosition(size);
  const left = box.x * size.width;
  const top = box.y * size.height;
  const bw = layout.borderWidth;
  // The CSS border sits inside the box; a PDF stroke is centred on its path.
  page.drawRectangle({
    x: left + bw / 2,
    y: size.height - top - layout.height + bw / 2,
    width: layout.width - bw,
    height: layout.height - bw,
    color: WHITE,
    borderColor: BLUE,
    borderWidth: bw,
  });
  for (const line of layout.lines) {
    const f = font(line.bold);
    const text = toEncodable(line.text, f);
    if (!text) continue;
    page.drawText(text, {
      x: left + layout.textLeft,
      y: size.height - top - line.baseline,
      size: layout.fontSize,
      font: f,
      color:
        line.tone === "header"
          ? HEADER
          : line.tone === "instruction"
            ? RED
            : BLUE,
    });
  }
}
