import { describe, expect, test } from "vitest";
import type { Item } from "../../db/types";
import { changesSinceExport, letterSnapshot } from "./exportedLetters";

const item = (id: string, kind: Item["kind"], letter: string) =>
  ({ id, kind, letter }) as Item;

describe("changesSinceExport", () => {
  const before = [
    item("1", "instruction", "A"),
    item("2", "instruction", "B"),
    item("3", "instruction", "C"),
    item("4", "observation", "A"),
  ];
  const snapshot = letterSnapshot(before);

  test("none when nothing changed", () => {
    expect(changesSinceExport(snapshot, before)).toEqual([]);
  });

  test("a delete re-letters the rest", () => {
    expect(
      changesSinceExport(snapshot, [
        item("1", "instruction", "A"),
        item("3", "instruction", "B"),
        item("4", "observation", "A"),
      ]),
    ).toEqual([
      "Instruction B was deleted",
      "Instruction C is now Instruction B",
    ]);
  });

  test("adds and kind switches", () => {
    expect(
      changesSinceExport(snapshot, [
        item("1", "instruction", "A"),
        item("2", "instruction", "B"),
        item("3", "observation", "B"),
        item("4", "observation", "A"),
        item("5", "instruction", "C"),
      ]),
    ).toEqual([
      "Instruction C is now Observation B",
      "Instruction C was added",
    ]);
  });
});
