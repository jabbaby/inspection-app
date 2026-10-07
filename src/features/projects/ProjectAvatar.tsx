import type { Project } from "../../db/types";
import { projectInitial } from "./projectInitial";

/** Badge colours: the brand maroon and markup blue, then calm companions. */
const COLOURS = ["#580B07", "#0165FC", "#0F6E56", "#8A5800", "#6B2E7A"];

/** A coloured initial badge, the same colour for a project every time. */
export function ProjectAvatar({
  project,
  large = false,
}: {
  project: Pick<Project, "id" | "jobName" | "jobNumber">;
  /** The bigger badge, e.g. on the home screen's Continue card. */
  large?: boolean;
}) {
  let hash = 0;
  for (const c of project.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className={large ? "project-avatar avatar-large" : "project-avatar"}
      style={{ background: COLOURS[hash % COLOURS.length] }}
      aria-hidden="true"
    >
      {projectInitial(project)}
    </span>
  );
}
