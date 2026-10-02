import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useId, useRef, useState } from "react";
import { db } from "../../db/db";
import { projectsWithJobNumber } from "../../db/projects";
import type { Project } from "../../db/types";
import { inspectionTitle } from "../inspections/inspectionTitle";
import { matchesSearch } from "./projectSearch";

export interface NewProjectDetails {
  jobNumber: string;
  jobName: string;
}

interface Props {
  open: boolean;
  title: string;
  /** "pick": choose a project; "new": start one; "both": either. */
  mode: "pick" | "new" | "both";
  /** Prefills a new project (e.g. the job name an inspection had). */
  initial?: Partial<NewProjectDetails>;
  /** Not offered (e.g. the inspection's current project). */
  excludeProjectId?: string | null;
  /** Offers "Skip for now" (the inspection is flagged Needs a project). */
  onSkip?: () => void;
  onPick: (projectId: string) => void;
  onCreate: (details: NewProjectDetails) => void;
  onCancel: () => void;
}

/**
 * Choose a project from the list (searchable), or start a new one with a
 * job number and name. A job number that's already used is flagged, with
 * the existing project offered instead (SPEC section 12).
 */
export function ProjectPicker(props: Props) {
  // Mounted only while open, so each opening starts afresh.
  return props.open ? <PickerDialog {...props} /> : null;
}

function PickerDialog({
  title,
  mode,
  initial,
  excludeProjectId,
  onSkip,
  onPick,
  onCreate,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [search, setSearch] = useState("");
  const [jobNumber, setJobNumber] = useState(initial?.jobNumber ?? "");
  const [jobName, setJobName] = useState(initial?.jobName ?? "");

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const projects = useLiveQuery(
    () => db.projects.orderBy("updatedAt").reverse().toArray(),
    [],
  );
  const duplicates =
    useLiveQuery(() => projectsWithJobNumber(db, jobNumber), [jobNumber]) ?? [];

  const listed = (projects ?? []).filter(
    (p) => p.id !== excludeProjectId && matchesSearch(p, search),
  );
  const showPick = mode !== "new";
  const showNew = mode !== "pick";

  return (
    <dialog
      ref={ref}
      className="confirm-dialog wide project-picker"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>

      {showPick && (
        <section aria-label="Choose a project">
          {showNew && <h3>Choose a project</h3>}
          <label className="field">
            <span>Find a project</span>
            <input
              type="search"
              value={search}
              placeholder="Job number, name or client"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {listed.length === 0 ? (
            <p className="muted">
              {projects?.length ? "No projects match." : "No projects yet."}
            </p>
          ) : (
            <ul className="project-picker-list" aria-label="Projects">
              {listed.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onPick(p.id)}>
                    <ProjectLabel project={p} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showNew && (
        <form
          aria-label="New project"
          onSubmit={(e) => {
            e.preventDefault();
            if (jobNumber.trim()) onCreate({ jobNumber, jobName });
          }}
        >
          {showPick && <h3>Or start a new project</h3>}
          <div className="form-grid">
            <label className="field">
              <span>Job number</span>
              <input
                value={jobNumber}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setJobNumber(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Job name</span>
              <input
                value={jobName}
                autoCapitalize="words"
                autoComplete="off"
                onChange={(e) => setJobName(e.target.value)}
              />
            </label>
          </div>
          {duplicates.length > 0 && (
            <div className="notice" role="status" data-testid="duplicate-job">
              <p>
                A project with job number {duplicates[0].jobNumber} already
                exists: <strong>{inspectionTitle(duplicates[0])}</strong>.
              </p>
              <p className="button-row">
                <button
                  type="button"
                  className="primary"
                  onClick={() => onPick(duplicates[0].id)}
                >
                  Use that project
                </button>
              </p>
            </div>
          )}
          <p className="button-row">
            <button
              type="submit"
              className={duplicates.length ? undefined : "primary"}
              disabled={!jobNumber.trim()}
            >
              {duplicates.length ? "Create a new one anyway" : "Create project"}
            </button>
          </p>
        </form>
      )}

      <p className="button-row dialog-actions">
        {onSkip && (
          <button type="button" onClick={onSkip}>
            Skip for now
          </button>
        )}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </p>
    </dialog>
  );
}

export function ProjectLabel({ project }: { project: Project }) {
  return (
    <>
      <span className="inspection-card-title">{inspectionTitle(project)}</span>
      {project.client.company && (
        <span className="muted">{project.client.company}</span>
      )}
    </>
  );
}
