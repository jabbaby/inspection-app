import { describe, expect, test } from "vitest";
import { paperLabel } from "./paperLabel";

describe("paperLabel", () => {
  test("names A sizes either way round, with millimetres", () => {
    expect(paperLabel(595.28, 841.89)).toBe("A4 (210 × 297 mm)");
    expect(paperLabel(2383.94, 1683.78)).toBe("A1 (841 × 594 mm)");
    expect(paperLabel(1190.55, 841.89)).toBe("A3 (420 × 297 mm)");
  });

  test("names B sizes too", () => {
    // B1 landscape and B2 portrait, in points.
    expect(paperLabel(2834.65, 2004.09)).toBe("B1 (1000 × 707 mm)");
    expect(paperLabel(1417.32, 2004.09)).toBe("B2 (500 × 707 mm)");
  });

  test("gives just the size for other papers", () => {
    expect(paperLabel(612, 792)).toBe("(216 × 279 mm)");
  });
});
