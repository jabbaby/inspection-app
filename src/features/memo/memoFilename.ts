/**
 * Export filename `{jobNumber}_{reference}_{itemInspected}.pdf` (SPEC 7a),
 * sanitised for iOS Files, Windows and email attachments.
 */
export function memoFilename(
  jobNumber: string,
  reference: string,
  itemInspected: string,
): string {
  const parts = [jobNumber, reference, itemInspected]
    .map(sanitise)
    .filter((part) => part.length > 0);
  const base = parts.join("_").slice(0, 120) || "memo";
  return `${base}.pdf`;
}

/** Makes text safe in a file name (iOS Files, Windows, email). */
export function sanitise(part: string): string {
  return part
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}
