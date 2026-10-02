import { describe, expect, test } from "vitest";
import type { InspectionPhoto } from "../../db/photos";
import { batches, photoFileName } from "./savePhotos";

const entry = (
  kind: "instruction" | "observation",
  letter: string,
  n: number,
) => ({ item: { kind, letter }, number: n }) as InspectionPhoto;

describe("saved photo names", () => {
  test("name the job, item and photo number", () => {
    expect(
      photoFileName("SY000001", entry("instruction", "A", 1), "image/jpeg"),
    ).toBe("SY000001 Instruction A 1.jpg");
    expect(
      photoFileName("SY000001", entry("observation", "B", 2), "image/heic"),
    ).toBe("SY000001 Observation B 2.heic");
  });

  test("leave out a missing job number and unsafe characters", () => {
    expect(photoFileName("", entry("instruction", "A", 1), "image/jpeg")).toBe(
      "Instruction A 1.jpg",
    );
    expect(
      photoFileName("SY/01:2", entry("instruction", "C", 3), "image/jpeg"),
    ).toBe("SY-01-2 Instruction C 3.jpg");
  });
});

describe("batches", () => {
  test("split into groups of 20", () => {
    const list = Array.from({ length: 45 }, (_, i) => i);
    expect(batches(list).map((b) => b.length)).toEqual([20, 20, 5]);
    expect(batches([])).toEqual([]);
  });
});

test("general photos are named General", () => {
  expect(
    photoFileName("SY000001", { item: null, number: 2 }, "image/jpeg"),
  ).toBe("SY000001 General 2.jpg");
});
