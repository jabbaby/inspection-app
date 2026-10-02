import { describe, expect, test } from "vitest";
import {
  compareItems,
  indexForLetter,
  itemLabel,
  letterForIndex,
} from "./letters";

describe("item letters", () => {
  test.each([
    [0, "A"],
    [1, "B"],
    [25, "Z"],
    [26, "AA"],
    [27, "AB"],
    [51, "AZ"],
    [52, "BA"],
    [701, "ZZ"],
    [702, "AAA"],
  ])("index %i is %s", (index, letter) => {
    expect(letterForIndex(index)).toBe(letter);
    expect(indexForLetter(letter)).toBe(index);
  });

  test("round-trips the first 2000 indexes", () => {
    for (let i = 0; i < 2000; i++) {
      expect(indexForLetter(letterForIndex(i))).toBe(i);
    }
  });

  test("rejects invalid input", () => {
    expect(() => letterForIndex(-1)).toThrow(RangeError);
    expect(() => letterForIndex(1.5)).toThrow(RangeError);
    expect(() => indexForLetter("a")).toThrow(RangeError);
    expect(() => indexForLetter("")).toThrow(RangeError);
  });
});

describe("item order and labels", () => {
  test("labels name the kind", () => {
    expect(itemLabel({ kind: "instruction", letter: "A" })).toBe(
      "Instruction A",
    );
    expect(itemLabel({ kind: "observation", letter: "AB" })).toBe(
      "Observation AB",
    );
  });

  test("observations come first, each kind in letter order", () => {
    const items = [
      { kind: "instruction", letter: "B" },
      { kind: "observation", letter: "AA" },
      { kind: "instruction", letter: "A" },
      { kind: "observation", letter: "B" },
    ] as const;
    expect([...items].sort(compareItems).map(itemLabel)).toEqual([
      "Observation B",
      "Observation AA",
      "Instruction A",
      "Instruction B",
    ]);
  });
});
