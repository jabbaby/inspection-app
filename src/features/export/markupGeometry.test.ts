import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, test } from "vitest";
import { boxLines, boxMetrics } from "../drawings/observationBox";
import {
  layoutNotesBox,
  normaliseRotation,
  pageView,
  pinMetrics,
  toPdfSpace,
  wrapWords,
} from "./markupGeometry";

const MM = 72 / 25.4;
const A1 = { width: 841 * MM, height: 594 * MM };
const A3 = { width: 420 * MM, height: 297 * MM };

describe("pinMetrics", () => {
  test("pins are 1.6% of the short side across", () => {
    expect((2 * pinMetrics(A1).radius) / MM).toBeCloseTo(9.5, 1);
    expect((2 * pinMetrics(A3).radius) / MM).toBeCloseTo(4.75, 1);
  });
});

describe("pageView", () => {
  test("normalises rotation like pdf.js", () => {
    expect(normaliseRotation(-90)).toBe(270);
    expect(normaliseRotation(450)).toBe(90);
    expect(normaliseRotation(45)).toBe(0);
  });

  test.each([0, 90, 180, 270])(
    "matches where pdf.js shows a point on a cropped page rotated %i",
    async (rotation) => {
      const doc = await PDFDocument.create();
      const page = doc.addPage([600, 400]);
      page.setCropBox(50, 30, 500, 300);
      page.setRotation(degrees(rotation));
      const bytes = await doc.save();

      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const viewport = (await pdf.getPage(1)).getViewport({ scale: 1 });
      const view = pageView(
        { x: 50, y: 30, width: 500, height: 300 },
        rotation,
      );
      expect(view.width).toBeCloseTo(viewport.width);
      expect(view.height).toBeCloseTo(viewport.height);

      // A point 20% across and 30% down the page as shown.
      const u = 0.2 * view.width;
      const v = view.height - 0.3 * view.height;
      const p = toPdfSpace(view, u, v);
      const [sx, sy] = viewport.convertToViewportPoint(p.x, p.y);
      expect(sx).toBeCloseTo(0.2 * viewport.width);
      expect(sy).toBeCloseTo(0.3 * viewport.height);
      await pdf.loadingTask.destroy();
    },
  );
});

describe("wrapWords", () => {
  const width = (t: string) => t.length;
  test("wraps at spaces", () => {
    expect(wrapWords("AB CD EF", 5, width)).toEqual(["AB CD", "EF"]);
  });
  test("splits a word wider than the line", () => {
    expect(wrapWords("ABCDEFG", 3, width)).toEqual(["ABC", "DEF", "G"]);
  });
  test("an empty line stays one empty line", () => {
    expect(wrapWords("", 3, width)).toEqual([""]);
  });
});

describe("layoutNotesBox", () => {
  const lines = boxLines({
    header: "NORTHROP INSPECTION | SLAB | T. ENGINEER | 01/10/2026",
    observationHeading: "Noted for information:",
    items: [
      { letter: "A", kind: "observation", text: "Crack" },
      { letter: "A", kind: "instruction", text: "Add bar" },
    ] as never,
  });
  const measure = (text: string, _bold: boolean, size: number) =>
    text.length * size * 0.6;

  test("stacks lines with a gap above each heading", () => {
    const layout = layoutNotesBox(lines, A1, measure);
    const m = boxMetrics(A1);
    expect(layout.width).toBe(m.width);
    expect(layout.lines.map((l) => l.text)).toEqual([
      "NORTHROP INSPECTION | SLAB | T. ENGINEER | 01/10/2026",
      "NOTED FOR INFORMATION:",
      "A. CRACK",
      "INSTRUCTIONS:",
      "A. ADD BAR",
    ]);
    expect(layout.lines.map((l) => l.bold)).toEqual([
      true,
      true,
      false,
      true,
      false,
    ]);
    const [header, heading, item] = layout.lines;
    expect(heading.baseline - header.baseline).toBeCloseTo(
      m.lineHeight + 0.35 * m.fontSize,
    );
    expect(item.baseline - heading.baseline).toBeCloseTo(m.lineHeight);
    expect(layout.height).toBeCloseTo(
      2 * (m.borderWidth + m.padding) +
        5 * m.lineHeight +
        2 * 0.35 * m.fontSize,
    );
  });

  test("wraps a long line inside the padding", () => {
    const long = boxLines({
      header: "H",
      observationHeading: "N:",
      items: [
        { letter: "A", kind: "observation", text: "word ".repeat(40) },
      ] as never,
    });
    const layout = layoutNotesBox(long, A1, measure);
    const m = boxMetrics(A1);
    const inner = m.width - 2 * (m.padding + m.borderWidth);
    expect(layout.lines.length).toBeGreaterThan(4);
    for (const line of layout.lines)
      expect(measure(line.text, line.bold, m.fontSize)).toBeLessThanOrEqual(
        inner,
      );
  });
});
