import { describe, expect, test } from "vitest";
import { TileCache } from "./tileCache";

const canvas = (pixels: number) => ({ width: pixels, height: 1, id: pixels });

describe("tile cache", () => {
  test("finds a kept tile covering the part, sharp enough", () => {
    const cache = new TileCache<ReturnType<typeof canvas>>(100, () => {});
    cache.add({
      pageKey: "p1",
      canvas: canvas(10),
      rect: { x: 0, y: 0, width: 100, height: 100 },
      scale: 2,
    });
    const part = { x: 10, y: 10, width: 50, height: 50 };
    expect(cache.find("p1", part, 2)).toBeDefined();
    expect(cache.find("p1", part, 3)).toBeUndefined();
    expect(cache.find("p2", part, 1)).toBeUndefined();
    expect(
      cache.find("p1", { x: 80, y: 10, width: 50, height: 50 }, 1),
    ).toBeUndefined();
  });

  test("prefers the least sharp tile that will do", () => {
    const cache = new TileCache<ReturnType<typeof canvas>>(100, () => {});
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    cache.add({ pageKey: "p", canvas: canvas(30), rect, scale: 4 });
    cache.add({ pageKey: "p", canvas: canvas(20), rect, scale: 2 });
    expect(cache.find("p", rect, 1.5)?.scale).toBe(2);
    expect(cache.find("p", rect, 3)?.scale).toBe(4);
  });

  test("over budget, the least recently used tile goes, never one on screen", () => {
    const released: number[] = [];
    const cache = new TileCache<ReturnType<typeof canvas>>(25, (c) =>
      released.push(c.id),
    );
    const rect = { x: 0, y: 0, width: 10, height: 10 };
    const a = cache.add({ pageKey: "p", canvas: canvas(10), rect, scale: 1 });
    cache.setShown(a, true);
    cache.add({ pageKey: "p", canvas: canvas(11), rect, scale: 2 });
    cache.add({ pageKey: "p", canvas: canvas(12), rect, scale: 3 });
    // 33 pixels: the oldest not on screen (11) goes, the shown one stays.
    expect(released).toEqual([11]);
    expect(cache.pixels).toBe(22);
    cache.setShown(a, false);
    cache.add({ pageKey: "p", canvas: canvas(9), rect, scale: 4 });
    expect(released).toEqual([11, 10]);
  });

  test("a page going off screen drops its tiles", () => {
    const released: number[] = [];
    const cache = new TileCache<ReturnType<typeof canvas>>(100, (c) =>
      released.push(c.id),
    );
    const rect = { x: 0, y: 0, width: 10, height: 10 };
    cache.add({ pageKey: "p1", canvas: canvas(5), rect, scale: 1 });
    cache.add({ pageKey: "p2", canvas: canvas(6), rect, scale: 1 });
    cache.dropPage("p1");
    expect(released).toEqual([5]);
    expect(cache.size).toBe(1);
  });
});
