import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { appCommit, appVersion } from "../../app/version";
import { db } from "../../db/db";
import { createInspection, deleteInspection } from "../../db/inspections";
import { createProject, jobInspection } from "../../db/projects";
import type { JobInspection, Project } from "../../db/types";
import { formatDateTime, formatLongDate } from "../../lib/dates";
import { ProjectPicker } from "../projects/ProjectPicker";
import { matchesSearch } from "../projects/projectSearch";
import { DeleteInspectionDialog } from "./DeleteInspectionDialog";
import { inspectionTitle } from "./inspectionTitle";
import { tabPath } from "./tabPath";

/** How many inspections Recent shows. */
const RECENT = 10;

/**
 * Inspections, in two tabs (SPEC section 12): Recent (the last 10 edited)
 * and Projects (searchable, with inspections that still need a project
 * flagged at the top). New inspection asks for its project first.
 */
export function InspectionsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "projects" ? "projects" : "recent";
  const data = useLiveQuery(async () => {
    const [inspections, projects] = await Promise.all([
      db.inspections.orderBy("updatedAt").reverse().toArray(),
      db.projects.toArray(),
    ]);
    const byId = new Map(projects.map((p) => [p.id, p]));
    return {
      inspections: inspections.map((i) =>
        jobInspection(i, i.projectId ? byId.get(i.projectId) : null),
      ),
      projects,
    };
  }, []);
  const [toDelete, setToDelete] = useState<JobInspection | null>(null);
  const [choosing, setChoosing] = useState(false);

  async function start(projectId: string | null) {
    setChoosing(false);
    const inspection = await createInspection(db, new Date(), projectId);
    // A new inspection starts with its job details.
    navigate(tabPath(inspection.id, "details"));
  }

  return (
    <section>
      <div className="page-heading">
        <h1>Inspections</h1>
        <button
          type="button"
          className="primary"
          onClick={() => setChoosing(true)}
        >
          New inspection
        </button>
      </div>

      <nav className="inspection-tabs" aria-label="Inspections view">
        <Link
          to="/"
          replace
          aria-current={view === "recent" ? "page" : undefined}
        >
          Recent
        </Link>
        <Link
          to="/?view=projects"
          replace
          aria-current={view === "projects" ? "page" : undefined}
        >
          Projects
        </Link>
      </nav>

      {data &&
        (view === "recent" ? (
          <RecentList
            inspections={data.inspections.slice(0, RECENT)}
            onDelete={setToDelete}
          />
        ) : (
          <ProjectsList
            projects={data.projects}
            inspections={data.inspections}
            search={params.get("q") ?? ""}
            onSearch={(q) =>
              setParams(q ? { view: "projects", q } : { view: "projects" }, {
                replace: true,
              })
            }
          />
        ))}

      <p className="app-version">
        Version {appVersion} ({appCommit})
      </p>

      <ProjectPicker
        open={choosing}
        title="New inspection"
        mode="both"
        onPick={(projectId) => void start(projectId)}
        onCreate={async (details) => {
          const project = await createProject(db, details);
          await start(project.id);
        }}
        onSkip={() => void start(null)}
        onCancel={() => setChoosing(false)}
      />

      <DeleteInspectionDialog
        inspection={toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={(inspection) => {
          setToDelete(null);
          void deleteInspection(db, inspection.id);
        }}
      />
    </section>
  );
}

function NeedsProject() {
  return <span className="flag">Needs a project</span>;
}

/** One inspection: title, client · date, and when it was edited. */
export function InspectionCard({
  inspection,
  onDelete,
}: {
  inspection: JobInspection;
  onDelete?: (inspection: JobInspection) => void;
}) {
  return (
    <li className="inspection-card">
      <Link
        to={
          inspection.projectId
            ? `/inspections/${inspection.id}`
            : tabPath(inspection.id, "details")
        }
        className="inspection-card-link"
      >
        <span className="inspection-card-title">
          {inspectionTitle(inspection)}
        </span>
        <span>
          {[
            inspection.itemInspected,
            inspection.client.company,
            formatLongDate(inspection.date),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="muted">
          Edited {formatDateTime(inspection.updatedAt)}
        </span>
        {!inspection.projectId && <NeedsProject />}
      </Link>
      {onDelete && (
        <button
          type="button"
          className="danger-outline"
          aria-label={`Delete ${inspectionTitle(inspection)}`}
          onClick={() => onDelete(inspection)}
        >
          Delete
        </button>
      )}
    </li>
  );
}

function RecentList({
  inspections,
  onDelete,
}: {
  inspections: JobInspection[];
  onDelete: (inspection: JobInspection) => void;
}) {
  if (inspections.length === 0)
    return <p className="empty-state">No inspections yet</p>;
  return (
    <ul className="inspection-list" aria-label="Recent inspections">
      {inspections.map((inspection) => (
        <InspectionCard
          key={inspection.id}
          inspection={inspection}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function ProjectsList({
  projects,
  inspections,
  search,
  onSearch,
}: {
  projects: Project[];
  inspections: JobInspection[];
  search: string;
  onSearch: (q: string) => void;
}) {
  const unsorted = inspections.filter((i) => !i.projectId);
  // Most recent activity first: the project's or one of its inspections'.
  const latest = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const i of inspections) {
    if (!i.projectId) continue;
    latest.set(
      i.projectId,
      Math.max(latest.get(i.projectId) ?? 0, i.updatedAt),
    );
    counts.set(i.projectId, (counts.get(i.projectId) ?? 0) + 1);
  }
  const listed = projects
    .filter((p) => matchesSearch(p, search))
    .sort(
      (a, b) =>
        Math.max(b.updatedAt, latest.get(b.id) ?? 0) -
        Math.max(a.updatedAt, latest.get(a.id) ?? 0),
    );

  return (
    <>
      {unsorted.length > 0 && (
        <section className="needs-project" aria-label="Needs a project">
          <h2>Needs a project</h2>
          <p className="muted">
            These were started before projects existed, or without one. Open
            each to create a new project for it or assign it to one.
          </p>
          <ul className="inspection-list" aria-label="Needs a project">
            {unsorted.map((inspection) => (
              <InspectionCard key={inspection.id} inspection={inspection} />
            ))}
          </ul>
        </section>
      )}

      <label className="field project-search">
        <span>Find a project</span>
        <input
          type="search"
          value={search}
          placeholder="Job number, name or client"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>
      {listed.length === 0 ? (
        <p className="empty-state">
          {projects.length ? "No projects match." : "No projects yet"}
        </p>
      ) : (
        <ul className="inspection-list" aria-label="Projects">
          {listed.map((p) => {
            const count = counts.get(p.id) ?? 0;
            return (
              <li key={p.id} className="inspection-card">
                <Link to={`/projects/${p.id}`} className="inspection-card-link">
                  <span className="inspection-card-title">
                    {inspectionTitle(p)}
                  </span>
                  <span>
                    {[
                      p.client.company,
                      `${count} inspection${count === 1 ? "" : "s"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
