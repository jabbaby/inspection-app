import { describe, expect, test } from "vitest";
import { fitWithin } from "./processPhoto";

describe("photo size", () => {
  test("shrinks the long edge to 1600 px, keeping the shape", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  test("never enlarges a small photo", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  test("handles very long, thin images", () => {
    expect(fitWithin(16000, 10)).toEqual({ width: 1600, height: 1 });
  });
});
