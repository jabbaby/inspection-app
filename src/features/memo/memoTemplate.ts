/**
 * Fixed memo wording that is template logic, not user-editable snippets
 * (SPEC section 4, docs/content/snippets.md "Rules"). Brand text (office
 * block, disclaimer, strapline) lives in src/brand/northrop.ts.
 */

export const SIGN_OFF = "Yours sincerely,";

export const DETAIL_LABELS = {
  siteVisitRequestedBy: "SITE VISIT REQUESTED BY",
  reasonForVisit: "REASON FOR VISIT:",
  inspector: "INSPECTOR:",
  sentVia: "SENT VIA",
} as const;

export const RECIPIENT_HEADINGS = {
  to: "To",
  copy: "Copy",
  company: "Company",
  attn: "Attn:",
} as const;

/** Body paragraph 1 (SPEC section 4). */
export function confirmationParagraph(itemInspected: string): string {
  return `We confirm having inspected the ${itemInspected} as highlighted on the drawing attached.`;
}

/**
 * The conditions lead-in: with one or more conditions the list follows
 * "Ok to proceed subject to the following:"; with none, "Ok to proceed."
 */
export function conditionsLeadIn(conditionCount: number): string {
  return conditionCount > 0
    ? "Ok to proceed subject to the following:"
    : "Ok to proceed.";
}

/** "SIM-001 – Level 3 slab reinforcement" (SPEC section 4). */
export function referenceLine(
  reference: string,
  itemInspected: string,
): string {
  return itemInspected ? `${reference} – ${itemInspected}` : reference;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-10-01" -> "1 October 2026". Other strings are shown as entered. */
export function formatMemoDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${Number(day)} ${monthName} ${year}` : isoDate;
}
