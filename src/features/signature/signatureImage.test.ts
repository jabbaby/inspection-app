import { describe, expect, test } from "vitest";
import { hasTransparency, inkBounds, removePaper } from "./signatureImage";

/** A width × height RGBA image filled with one colour. */
function image(width: number, height: number, rgba: number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return data;
}

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  rgba: number[],
) {
  data.set(rgba, (y * width + x) * 4);
}

describe("inkBounds", () => {
  test("is null for a blank image", () => {
    expect(inkBounds(image(10, 10, [0, 0, 0, 0]), 10, 10)).toBeNull();
  });

  test("boxes the ink with padding, kept inside the image", () => {
    const data = image(20, 10, [0, 0, 0, 0]);
    setPixel(data, 20, 5, 4, [0, 0, 0, 255]);
    setPixel(data, 20, 12, 6, [0, 0, 0, 255]);
    expect(inkBounds(data, 20, 10, 2)).toEqual({
      x: 3,
      y: 2,
      width: 12,
      height: 7,
    });
    expect(inkBounds(data, 20, 10, 8)).toEqual({
      x: 0,
      y: 0,
      width: 20,
      height: 10,
    });
  });

  test("ignores faint specks", () => {
    const data = image(10, 10, [0, 0, 0, 0]);
    setPixel(data, 10, 1, 1, [0, 0, 0, 10]);
    expect(inkBounds(data, 10, 10)).toBeNull();
  });
});

describe("removePaper", () => {
  test("paper goes see-through and dark ink stays solid", () => {
    const data = image(10, 10, [255, 255, 255, 255]);
    setPixel(data, 10, 3, 3, [20, 20, 60, 255]);
    removePaper(data);
    expect(data[3]).toBe(0);
    const ink = (3 * 10 + 3) * 4;
    expect(Array.from(data.slice(ink, ink + 4))).toEqual([20, 20, 60, 255]);
  });

  test("works on grey-looking paper in a photo", () => {
    const data = image(10, 10, [180, 180, 175, 255]);
    setPixel(data, 10, 2, 2, [40, 40, 40, 255]);
    removePaper(data);
    expect(data[3]).toBe(0);
    expect(data[(2 * 10 + 2) * 4 + 3]).toBe(255);
  });

  test("mid-grey ink edges are partly see-through", () => {
    const data = image(10, 10, [255, 255, 255, 255]);
    setPixel(data, 10, 0, 0, [185, 185, 185, 255]);
    removePaper(data);
    expect(data[3]).toBeGreaterThan(0);
    expect(data[3]).toBeLessThan(255);
  });
});

describe("hasTransparency", () => {
  test("a cut-out PNG has it; an opaque photo doesn't", () => {
    expect(hasTransparency(image(10, 10, [0, 0, 0, 0]))).toBe(true);
    expect(hasTransparency(image(10, 10, [255, 255, 255, 255]))).toBe(false);
  });
});
