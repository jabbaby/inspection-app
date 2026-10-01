import { describe, expect, test } from "vitest";
import {
  clampTransform,
  fitTransform,
  normalisedToScreen,
  pageToScreen,
  panBy,
  screenToNormalised,
  screenToPage,
  visiblePageRect,
  zoomAt,
  zoomLimits,
  type ViewTransform,
} from "./viewTransform";

const A1 = { width: 2383.94, height: 1683.78 };
const IPAD = { width: 1180, height: 760 };

describe("fitTransform", () => {
  test("fits an A1 sheet inside the view, centred", () => {
    const t = fitTransform(A1, IPAD, 16);
    const topLeft = pageToScreen(t, { x: 0, y: 0 });
    const bottomRight = pageToScreen(t, { x: A1.width, y: A1.height });

    expect(topLeft.x).toBeGreaterThanOrEqual(16 - 1e-9);
    expect(topLeft.y).toBeGreaterThanOrEqual(16 - 1e-9);
    expect(bottomRight.x).toBeLessThanOrEqual(IPAD.width - 16 + 1e-9);
    expect(bottomRight.y).toBeLessThanOrEqual(IPAD.height - 16 + 1e-9);
    expect(topLeft.x + bottomRight.x).toBeCloseTo(IPAD.width);
    expect(topLeft.y + bottomRight.y).toBeCloseTo(IPAD.height);
  });
});

describe("zoomAt", () => {
  test("keeps the page point under the pinch centre fixed", () => {
    const t = fitTransform(A1, IPAD);
    const at = { x: 400, y: 300 };
    const before = screenToPage(t, at);
    const zoomed = zoomAt(t, 3.7, at, zoomLimits(t.scale));

    const after = screenToPage(zoomed, at);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(zoomed.scale).toBeCloseTo(t.scale * 3.7);
  });

  test("clamps to the zoom limits", () => {
    const t = fitTransform(A1, IPAD);
    const limits = zoomLimits(t.scale);
    expect(zoomAt(t, 1000, { x: 0, y: 0 }, limits).scale).toBe(limits.max);
    expect(zoomAt(t, 0.001, { x: 0, y: 0 }, limits).scale).toBe(limits.min);
  });
});

describe("normalised coordinates", () => {
  test("round-trip at any zoom and pan", () => {
    const transforms: ViewTransform[] = [
      fitTransform(A1, IPAD),
      { scale: 2.5, x: -1800, y: -900 },
      { scale: 0.2, x: 37, y: 91 },
    ];
    for (const t of transforms) {
      for (const n of [
        { x: 0, y: 0 },
        { x: 0.25, y: 0.4 },
        { x: 1, y: 1 },
      ]) {
        const back = screenToNormalised(t, normalisedToScreen(t, n, A1), A1);
        expect(back!.x).toBeCloseTo(n.x, 9);
        expect(back!.y).toBeCloseTo(n.y, 9);
      }
    }
  });

  test("a pin stays on the same page point after zooming", () => {
    const t = fitTransform(A1, IPAD);
    const pin = screenToNormalised(t, { x: 500, y: 350 }, A1)!;
    const zoomed = panBy(
      zoomAt(t, 6, { x: 200, y: 600 }, zoomLimits(t.scale)),
      -40,
      25,
    );
    const onScreen = normalisedToScreen(zoomed, pin, A1);
    expect(screenToNormalised(zoomed, onScreen, A1)).toEqual(pin);
  });

  test("is null off the page", () => {
    const t = fitTransform(A1, IPAD, 50);
    expect(screenToNormalised(t, { x: 2, y: 2 }, A1)).toBeNull();
  });
});

describe("clampTransform", () => {
  test("keeps part of a zoomed page on screen", () => {
    const flungAway = { scale: 3, x: 50_000, y: -50_000 };
    const t = clampTransform(flungAway, A1, IPAD, 80);
    expect(t.x).toBe(IPAD.width - 80);
    expect(t.y).toBe(80 - A1.height * 3);
  });

  test("leaves a sensible transform unchanged", () => {
    const fit = fitTransform(A1, IPAD);
    expect(clampTransform(fit, A1, IPAD)).toEqual(fit);
  });
});

describe("visiblePageRect", () => {
  test("is the whole page at fit", () => {
    const rect = visiblePageRect(fitTransform(A1, IPAD), A1, IPAD)!;
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y).toBeCloseTo(0);
    expect(rect.width).toBeCloseTo(A1.width);
    expect(rect.height).toBeCloseTo(A1.height);
  });

  test("is the on-screen part when zoomed in", () => {
    const t = { scale: 2, x: -1000, y: -500 };
    expect(visiblePageRect(t, A1, IPAD)).toEqual({
      x: 500,
      y: 250,
      width: IPAD.width / 2,
      height: IPAD.height / 2,
    });
  });

  test("is null when the page is off screen", () => {
    expect(visiblePageRect({ scale: 1, x: 5000, y: 0 }, A1, IPAD)).toBeNull();
  });
});
