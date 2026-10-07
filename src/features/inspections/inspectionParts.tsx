import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { rememberBack } from "../../app/backTarget";
import { db } from "../../db/db";
import { createInspection } from "../../db/inspections";
import { createProject } from "../../db/projects";
import type { JobInspection } from "../../db/types";
import { ProjectAvatar } from "../projects/ProjectAvatar";
import { ProjectPicker } from "../projects/ProjectPicker";
import type { InspectionProgress } from "./homeData";
import { tabPath, type InspectionTab } from "./tabPath";

/**
 * New inspection: asks for its project (choose, start one, or skip), then
 * opens it on Pre-inspection. `from` is where its back button returns.
 */
export function NewInspectionButton({ from }: { from: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function start(projectId: string | null) {
    setOpen(false);
    const inspection = await createInspection(db, new Date(), projectId);
    rememberBack(`inspection:${inspection.id}`, from);
    // A new inspection starts with its job details.
    navigate(tabPath(inspection.id, "details"));
  }

  return (
    <>
      <button type="button" className="primary" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" /> New inspection
      </button>
      <ProjectPicker
        open={open}
        title="New inspection"
        mode="both"
        onPick={(projectId) => void start(projectId)}
        onCreate={async (details) => {
          const project = await createProject(db, details);
          await start(project.id);
        }}
        onSkip={() => void start(null)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

/** New project: a job number and name, then its page. */
export function NewProjectButton({ from }: { from: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="quiet small"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" /> New project
      </button>
      <ProjectPicker
        open={open}
        title="New project"
        mode="new"
        onPick={() => setOpen(false)}
        onCreate={async (details) => {
          const project = await createProject(db, details);
          setOpen(false);
          rememberBack(`project:${project.id}`, from);
          navigate(`/projects/${project.id}`);
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

/** Opens an inspection's step; its back button returns to `from`. */
export function InspectionLink({
  inspection,
  tab,
  from,
  className,
  title,
  children,
}: {
  inspection: JobInspection;
  /** A step, or (default) where it opens: Inspection, or Pre-inspection while it needs a project. */
  tab?: InspectionTab;
  from: string;
  className: string;
  title?: string;
  children: ReactNode;
}) {
  const to = tab
    ? tabPath(inspection.id, tab)
    : inspection.projectId
      ? `/inspections/${inspection.id}`
      : tabPath(inspection.id, "details");
  return (
    <Link
      to={to}
      className={className}
      title={title}
      onClick={() => rememberBack(`inspection:${inspection.id}`, from)}
    >
      {children}
    </Link>
  );
}

/** The project's badge, or a plain one for an inspection without a project. */
export function InspectionAvatar({
  inspection,
}: {
  inspection: JobInspection;
}) {
  if (!inspection.projectId)
    return (
      <span className="project-avatar avatar-none" aria-hidden="true">
        ?
      </span>
    );
  return (
    <ProjectAvatar
      project={{
        id: inspection.projectId,
        jobName: inspection.jobName,
        jobNumber: inspection.jobNumber,
      }}
    />
  );
}

/** The status chip: needs a project, its memo, or how far it has got. */
export function StatusChip({
  inspection,
  progress,
}: {
  inspection: JobInspection;
  progress?: InspectionProgress;
}) {
  if (!inspection.projectId)
    return <span className="chip chip-danger">Needs a project</span>;
  if (progress?.memoReference)
    return <span className="chip chip-ok">Memo {progress.memoReference}</span>;
  const n = progress?.itemCount ?? 0;
  if (n === 0) return <span className="chip">No items yet</span>;
  return (
    <span className="chip chip-todo">
      {n} item{n === 1 ? "" : "s"}, no memo
    </span>
  );
}
