import type { JobInspection } from "../../db/types";

/** "SY000001 – Example Apartments", with placeholders for blank fields. */
export function inspectionTitle(
  inspection: Pick<JobInspection, "jobNumber" | "jobName">,
): string {
  const number = inspection.jobNumber.trim() || "No job number";
  const name = inspection.jobName.trim() || "Untitled job";
  return `${number} – ${name}`;
}
