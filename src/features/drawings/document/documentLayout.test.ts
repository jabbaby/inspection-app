import { describe, expect, test } from "vitest";
import {
  DOC_WIDTH,
  PAGE_GAP,
  hitPage,
  layoutDocument,
  pageAtY,
  pagePointToDoc,
  pagesInRange,
  visiblePart,
} from "./documentLayout";

const A1: [number, number] = [2383.94, 1683.78];
const A4: [number, number] = [595.28, 841.89];

const layout = layoutDocument([
  { id: "d1", name: "S-101", pageSizes: [A1, A1] },
  { id: "d2", name: "S-001 notes", pageSizes: [A4] },
]);

describe("layoutDocument", () => {
  test("stacks every page at the same width, numbered through the document", () => {
    expect(layout.pages.map((p) => p.key)).toEqual(["d1:1", "d1:2", "d2:1"]);
    expect(layout.pages.map((p) => p.number)).toEqual([1, 2, 3]);
    const [p1, p2, p3] = layout.pages;
    expect(p1.top).toBe(0);
    // No break between drawings: the next drawing follows after one gap.
    expect(p3.top).toBeCloseTo(p2.top + p2.height + PAGE_GAP);
    expect(p1.height).toBeCloseTo((A1[1] / A1[0]) * DOC_WIDTH);
    expect(p2.top).toBeCloseTo(p1.top + p1.height + PAGE_GAP);
    // The A4 page is as wide as the A1 sheets, so it is taller.
    expect(p3.height).toBeCloseTo((A4[1] / A4[0]) * DOC_WIDTH);
    expect(p3.scale).toBeCloseTo(DOC_WIDTH / A4[0]);
    expect(layout.height).toBeCloseTo(p3.top + p3.height);
  });

  test("is empty with no drawings", () => {
    expect(layoutDocument([])).toEqual({
      width: DOC_WIDTH,
      height: 0,
      pages: [],
    });
  });
});

describe("lookups", () => {
  test("pageAtY finds the page under or nearest a point", () => {
    const [p1, p2, p3] = layout.pages;
    expect(pageAtY(layout, p1.top + 10)?.key).toBe("d1:1");
    expect(pageAtY(layout, p2.top + p2.height / 2)?.key).toBe("d1:2");
    expect(pageAtY(layout, -500)?.key).toBe("d1:1");
    expect(pageAtY(layout, p3.top - 5)?.key).toBe("d2:1");
  });

  test("hitPage and pagePointToDoc round-trip, and gaps hit nothing", () => {
    const p2 = layout.pages[1];
    const doc = pagePointToDoc(p2, { x: 0.25, y: 0.4 });
    const hit = hitPage(layout, doc)!;
    expect(hit.page.key).toBe("d1:2");
    expect(hit.at.x).toBeCloseTo(0.25);
    expect(hit.at.y).toBeCloseTo(0.4);
    expect(hitPage(layout, { x: 500, y: p2.top - PAGE_GAP / 2 })).toBeNull();
    expect(hitPage(layout, { x: -1, y: p2.top + 5 })).toBeNull();
  });

  test("pagesInRange includes the margin", () => {
    const [p1, p2] = layout.pages;
    expect(pagesInRange(layout, p1.top, p1.top + 10).map((p) => p.key)).toEqual(
      ["d1:1"],
    );
    expect(
      pagesInRange(layout, p1.top, p1.top + 10, p1.height + PAGE_GAP).map(
        (p) => p.key,
      ),
    ).toEqual(["d1:1", "d1:2"]);
    expect(
      pagesInRange(layout, p2.top + 1, p2.top + 2).map((p) => p.key),
    ).toEqual(["d1:2"]);
  });

  test("visiblePart converts a document rectangle to page points", () => {
    const p1 = layout.pages[0];
    const part = visiblePart(p1, {
      x: 250,
      y: p1.top + 100,
      width: 500,
      height: 200,
    })!;
    expect(part.x).toBeCloseTo(250 / p1.scale);
    expect(part.y).toBeCloseTo(100 / p1.scale);
    expect(part.width).toBeCloseTo(500 / p1.scale);
    expect(part.height).toBeCloseTo(200 / p1.scale);
    expect(
      visiblePart(p1, {
        x: 0,
        y: p1.top + p1.height + 1,
        width: 100,
        height: 5,
      }),
    ).toBeNull();
  });
});
