import { describe, expect, test } from "vitest";
import { indexForLetter, letterForIndex } from "./letters";

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
