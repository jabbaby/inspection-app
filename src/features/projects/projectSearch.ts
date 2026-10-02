import type { Project } from "../../db/types";

/** True when every word typed appears in the job number, name or client. */
export function matchesSearch(
  project: Pick<Project, "jobNumber" | "jobName" | "client">,
  search: string,
): boolean {
  const haystack = [
    project.jobNumber,
    project.jobName,
    project.client.name,
    project.client.company,
  ]
    .join(" ")
    .toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
