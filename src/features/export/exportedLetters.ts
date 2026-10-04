/**
 * Letters can change after a memo is exported (an item deleted, added,
 * switched or reordered re-letters the rest; SPEC section 5). The export
 * keeps each item's letter so the app can warn before the old PDF is sent.
 */
import type { Item } from "../../db/types";
import { compareItems, itemLabel } from "../items/letters";

/** Each item's kind and letter, by id: "instruction:A". */
export function letterSnapshot(items: Item[]): Record<string, string> {
  return Object.fromEntries(
    items.map((item) => [item.id, `${item.kind}:${item.letter}`]),
  );
}

function labelOf(value: string): string {
  const [kind, letter] = value.split(":");
  return itemLabel({
    kind: kind === "observation" ? "observation" : "instruction",
    letter,
  });
}

/**
 * What changed since the snapshot, in plain words, e.g. "Instruction D is
 * now Instruction C", "Instruction C was deleted", "Observation B was
 * added". Empty when the letters are as exported.
 */
export function changesSinceExport(
  snapshot: Record<string, string>,
  items: Item[],
): string[] {
  const changes: string[] = [];
  const now = new Map(items.map((item) => [item.id, item]));
  for (const [id, before] of Object.entries(snapshot))
    if (!now.has(id)) changes.push(`${labelOf(before)} was deleted`);
  for (const item of [...items].sort(compareItems)) {
    const before = snapshot[item.id];
    const label = itemLabel(item);
    if (before === undefined) changes.push(`${label} was added`);
    else if (before !== `${item.kind}:${item.letter}`)
      changes.push(`${labelOf(before)} is now ${label}`);
  }
  return changes;
}
