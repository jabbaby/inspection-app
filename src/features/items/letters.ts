/**
 * Item letters, per inspection: A, B ... Z, AA, AB ... ZZ, AAA ...
 * (bijective base 26, like spreadsheet columns). Letters are never reused
 * within an inspection unless the user re-letters (SPEC section 5), so the
 * caller keeps a running index rather than filling gaps.
 */

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
