import { describe, expect, test } from "vitest";
import type { Item } from "../../db/types";
import {
  boxHeader,
  boxMetrics,
  clampBoxPosition,
  defaultBoxPosition,
  initialAndSurname,
  observationLines,
} from "./observationBox";

const A1 = { width: 2383.94, height: 1683.78 };
const A4 = { width: 595.28, height: 841.89 };

describe("box size", () => {
  test("scales with the sheet", () => {
    expect(boxMetrics(A1).fontSize).toBeCloseTo(20.2, 1);
    expect(boxMetrics(A4).fontSize).toBeCloseTo(7.1, 1);
  });

  test("defaults to the top right, inside the page", () => {
    for (const page of [A1, A4]) {
      const p = defaultBoxPosition(page);
      const m = boxMetrics(page);
      expect(p.x * page.width + m.width).toBeCloseTo(page.width - m.margin);
      expect(p.y * page.height).toBeCloseTo(m.margin);
    }
  });

  test("clamps a dragged box onto the page", () => {
    const p = clampBoxPosition({ x: 1.5, y: -0.2 }, A1);
    expect(p.y).toBe(0);
    expect(p.x * A1.width + boxMetrics(A1).width).toBeCloseTo(A1.width);
  });
});

describe("header line", () => {
  test("formats every part", () => {
    expect(
      boxHeader({
        itemInspected: "Level 3 slab reinforcement",
        inspector: "Test Engineer",
        date: "2026-10-01",
      }),
    ).toBe(
      "NORTHROP INSPECTION | Level 3 slab reinforcement | T. Engineer | 01/10/2026",
    );
  });

  test("leaves out empty parts", () => {
    expect(
      boxHeader({ itemInspected: " ", inspector: "", date: "2026-10-01" }),
    ).toBe("NORTHROP INSPECTION | 01/10/2026");
  });

  test.each([
    ["Test Engineer", "T. Engineer"],
    ["  alex  van der berg ", "A. berg"],
    ["J. R. Smith", "J. Smith"],
    ["Madonna", "Madonna"],
    ["", ""],
  ])("initialAndSurname(%j) is %j", (name, expected) => {
    expect(initialAndSurname(name)).toBe(expected);
  });
});

test("observation lines are in letter order and skip instructions", () => {
  const item = (letter: string, kind: Item["kind"], text: string) =>
    ({ letter, kind, text }) as Item;
  expect(
    observationLines([
      item("AA", "observation", "Late one"),
      item("D", "observation", "Existing crack noted at grid 4"),
      item("B", "instruction", "Add bar"),
      item("C", "observation", ""),
    ]),
  ).toEqual(["C.", "D. Existing crack noted at grid 4", "AA. Late one"]);
});
