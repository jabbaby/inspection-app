import type { Project } from "../../db/types";

/**
 * The first letter of the job name, skipping digits (or of the job number
 * when the name has none), e.g. "12 Example St" → E.
 */
export function projectInitial(
  project: Pick<Project, "jobName" | "jobNumber">,
) {
  const letter = /\p{L}/u;
  const found =
    project.jobName.match(letter) ?? project.jobNumber.match(letter);
  return found ? found[0].toUpperCase() : "?";
}
