/**
 * Turns a memo, its inspection and the inspection's items into what the
 * memo page shows (SPEC section 4). Pure, so the editor's preview and the
 * exported PDF are built the same way.
 */
import type {
  Client,
  JobInspection,
  Item,
  Memo,
  MemoFields,
  Recipient,
  Snippet,
} from "../../db/types";
import { indexForLetter } from "../items/letters";
import { confirmationParagraph } from "./memoTemplate";
import type { MemoPdfInput } from "./pdf/renderMemoPdf";

export const COMPLETE_ITEMS_ID = "condition-complete-listed-items";
export const PHOTO_CONFIRMATION_ID = "condition-photo-confirmation";

/** Instructions in letter order (only instructions appear in the memo). */
export function memoInstructions(items: Item[]): Item[] {
  return items
    .filter((item) => item.kind === "instruction")
    .sort((a, b) => indexForLetter(a.letter) - indexForLetter(b.letter));
}

/** ["A", "B", "C"] -> "A–C"; one letter -> "A". Letters have no gaps. */
export function letterRange(letters: string[]): string {
  const sorted = [...letters].sort(
    (a, b) => indexForLetter(a) - indexForLetter(b),
  );
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return sorted[0];
  return `${sorted[0]}–${sorted[sorted.length - 1]}`;
}

/** "Dear Alex," from the first name of the first "To" recipient's Attn. */
export function defaultSalutation(recipients: Recipient[]): string {
  const first = recipients.find((r) => r.to && r.attn.trim());
  const name = first?.attn.trim().split(/\s+/)[0];
  return name ? `Dear ${name},` : "";
}

/** "Alex Example, Example Builders Pty Ltd". */
export function defaultSiteVisitRequestedBy(client: Client): string {
  return [client.name, client.company]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Whether a standard condition is ticked. Unless the engineer chose,
 * "Complete items [letters] listed below." is on when there are
 * instructions, and the photo condition when any instruction needs photo
 * confirmation; others start off.
 */
export function conditionTicked(
  memo: Pick<Memo, "conditionChoices">,
  snippetId: string,
  instructions: Item[],
): boolean {
  const chosen = memo.conditionChoices[snippetId];
  if (chosen !== undefined) return chosen;
  if (snippetId === COMPLETE_ITEMS_ID) return instructions.length > 0;
  if (snippetId === PHOTO_CONFIRMATION_ID)
    return instructions.some((item) => item.requiresPhotoConfirmation);
  return false;
}

export interface MemoCondition {
  /** Snippet id (standard condition) or item id (instruction). */
  key: string;
  kind: "standard" | "instruction";
  text: string;
  /** Instructions: reworded for this memo rather than the item's text. */
  reworded?: boolean;
}

/**
 * The bulleted conditions: ticked standard conditions first ("[letters]"
 * filled in, e.g. "A–D"), then each instruction as "A. text", reworded
 * where the engineer changed it for this memo.
 */
export function memoConditions(
  memo: Pick<Memo, "conditionChoices" | "itemOverrides">,
  items: Item[],
  conditionSnippets: Snippet[],
): MemoCondition[] {
  const instructions = memoInstructions(items);
  const letters = letterRange(instructions.map((item) => item.letter));
  const standard = conditionSnippets
    .filter((s) => conditionTicked(memo, s.id, instructions))
    .map<MemoCondition>((s) => ({
      key: s.id,
      kind: "standard",
      text: s.text.replace(/\[letters\]/g, letters).trim(),
    }));
  const lines = instructions.map<MemoCondition>((item) => {
    const override = memo.itemOverrides[item.id];
    return {
      key: item.id,
      kind: "instruction",
      text: `${item.letter}. ${(override ?? item.text).trim()}`.trim(),
      reworded: override !== undefined,
    };
  });
  return [...standard, ...lines];
}

/** Memo fields for the page: job details from the inspection, the rest from the memo. */
export function memoFields(memo: Memo, inspection: JobInspection): MemoFields {
  return {
    clientName: inspection.client.name,
    clientCompany: inspection.client.company,
    address1: inspection.client.address1,
    address2: inspection.client.address2,
    date: inspection.date,
    jobNumber: inspection.jobNumber,
    jobName: inspection.jobName,
    recipients: memo.recipients,
    siteVisitRequestedBy:
      memo.siteVisitRequestedBy ??
      defaultSiteVisitRequestedBy(inspection.client),
    reasonForVisit: memo.reasonForVisit ?? inspection.itemInspected,
    inspector: inspection.inspector,
    sentVia: memo.sentVia,
    salutation: memo.salutation ?? defaultSalutation(memo.recipients),
    itemInspected: inspection.itemInspected,
    signOffName: memo.signOffName,
    signOffTitle: memo.signOffTitle,
  };
}

/** Everything the memo PDF needs. */
export function buildMemoPdfInput(
  memo: Memo,
  inspection: JobInspection,
  items: Item[],
  conditionSnippets: Snippet[],
): MemoPdfInput {
  return {
    reference: memo.reference,
    fields: memoFields(memo, inspection),
    bodyParagraphs: [
      confirmationParagraph(inspection.itemInspected),
      memo.bodyText.trim(),
    ].filter(Boolean),
    conditions: memoConditions(memo, items, conditionSnippets).map(
      (c) => c.text,
    ),
  };
}
