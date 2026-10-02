/**
 * Item letters: A, B ... Z, AA, AB ... ZZ, AAA ... (bijective base 26, like
 * spreadsheet columns). Instructions and observations are lettered
 * separately, each A, B, C ... across the inspection in pin creation order
 * (SPEC section 5), so an instruction A and an observation A can both exist.
 */
import type { ItemKind } from "../../db/types";

/** 0 -> "A", 25 -> "Z", 26 -> "AA", 701 -> "ZZ", 702 -> "AAA". */
export function letterForIndex(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`Invalid letter index: ${index}`);
  }
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Inverse of letterForIndex: "A" -> 0, "AA" -> 26. */
export function indexForLetter(letter: string): number {
  if (!/^[A-Z]+$/.test(letter)) {
    throw new RangeError(`Invalid item letter: ${letter}`);
  }
  let n = 0;
  for (const char of letter) n = n * 26 + (char.charCodeAt(0) - 64);
  return n - 1;
}

/** "Instruction" or "Observation". */
export function kindName(kind: ItemKind): string {
  return kind === "instruction" ? "Instruction" : "Observation";
}

/** "Instruction A" / "Observation A": letters alone are ambiguous. */
export function itemLabel(item: { kind: ItemKind; letter: string }): string {
  return `${kindName(item.kind)} ${item.letter}`;
}

/**
 * List order everywhere items are listed: observations A, B ... then
 * instructions A, B ... (the notes box order).
 */
export function compareItems(
  a: { kind: ItemKind; letter: string },
  b: { kind: ItemKind; letter: string },
): number {
  if (a.kind !== b.kind) return a.kind === "observation" ? -1 : 1;
  return indexForLetter(a.letter) - indexForLetter(b.letter);
}

/**
 * Items split into the list's groups, in list order (observations, then
 * instructions), leaving out an empty group. Items must already be sorted
 * with compareItems.
 */
export function groupItems<T extends { kind: ItemKind; letter: string }>(
  items: T[],
): { kind: ItemKind; heading: string; items: T[] }[] {
  return (["observation", "instruction"] as const)
    .map((kind) => ({
      kind,
      heading: `${kindName(kind)}s`,
      items: items.filter((item) => item.kind === kind),
    }))
    .filter((group) => group.items.length > 0);
}
