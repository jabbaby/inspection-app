import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont } from "pdf-lib";
import { beforeAll, describe, expect, test } from "vitest";
import { loadTestMemoAssets } from "./memoAssets.testutil";
import { toEncodable, wrapRuns, wrapText } from "./text";

let regular: PDFFont;
let bold: PDFFont;

beforeAll(async () => {
  const assets = await loadTestMemoAssets();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  regular = await doc.embedFont(assets.fonts.regular);
  bold = await doc.embedFont(assets.fonts.bold);
});

describe("wrapText", () => {
  test("keeps short text on one line", () => {
    expect(wrapText("Ok to proceed.", regular, 9, 300)).toEqual([
      "Ok to proceed.",
    ]);
  });

  test("wraps at spaces and every line fits", () => {
    const text =
      "At the time of the inspection the works were generally in accordance with the structural design.";
    const lines = wrapText(text, regular, 9, 150);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe(text);
    for (const line of lines) {
      expect(regular.widthOfTextAtSize(line, 9)).toBeLessThanOrEqual(150);
      expect(line).toBe(line.trim());
    }
  });

  test("honours explicit line breaks", () => {
    expect(wrapText("Line one\nLine two", regular, 9, 300)).toEqual([
      "Line one",
      "Line two",
    ]);
  });

  test("breaks a word longer than the line", () => {
    const lines = wrapText("A".repeat(80), regular, 9, 100);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("A".repeat(80));
  });

  test("returns no lines for empty text", () => {
    expect(wrapText("", regular, 9, 100)).toEqual([]);
  });
});

describe("wrapRuns", () => {
  test("mixes fonts on one line and merges same-font runs", () => {
    const lines = wrapRuns(
      [
        { text: "Bold lead.", font: bold },
        { text: " ", font: regular },
        { text: "Regular body.", font: regular },
      ],
      7,
      500,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].map((r) => [r.text, r.font === bold])).toEqual([
      ["Bold lead.", true],
      [" Regular body.", false],
    ]);
  });
});

test("toEncodable swaps unsupported characters for ?", () => {
  expect(toEncodable("Grid C–4 👷\ttab", regular)).toBe("Grid C–4 ? tab");
});
