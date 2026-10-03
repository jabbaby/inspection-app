import { useLiveQuery } from "dexie-react-hooks";
import {
  Building2,
  ChevronRight,
  Clock,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { rememberBack } from "../../app/backTarget";
import { appCommit, appVersion } from "../../app/version";
import { db } from "../../db/db";
import { createInspection, deleteInspection } from "../../db/inspections";
import { createProject, jobInspection } from "../../db/projects";
import type { JobInspection, Project } from "../../db/types";
import { formatDateTime, formatLongDate } from "../../lib/dates";
import { ProjectAvatar } from "../projects/ProjectAvatar";
import { ProjectPicker } from "../projects/ProjectPicker";
import { matchesSearch } from "../projects/projectSearch";
import { DeleteInspectionDialog } from "./DeleteInspectionDialog";
import { inspectionTitle } from "./inspectionTitle";
import { tabPath } from "./tabPath";

/** How many inspections Recent shows. */
const RECENT = 10;

/** What's done on an inspection, for its status chip. */
export interface InspectionProgress {
  memoReference: string | null;
  itemCount: number;
}

/**
 * Inspections home (SPEC section 12): recent inspections and projects side
 * by side (stacked in portrait). New inspection asks for its project first.
 */
export function InspectionsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const data = useLiveQuery(async () => {
    const [inspections, projects, memos, items] = await Promise.all([
      db.inspections.orderBy("updatedAt").reverse().toArray(),
      db.projects.toArray(),
      db.memos.toArray(),
      db.items.toArray(),
    ]);
    const byId = new Map(projects.map((p) => [p.id, p]));
    const progress = new Map<string, InspectionProgress>();
    for (const i of inspections)
      progress.set(i.id, { memoReference: null, itemCount: 0 });
    for (const m of memos) {
      const p = progress.get(m.inspectionId);
      if (p) p.memoReference = m.reference;
    }
    for (const item of items) {
      const p = progress.get(item.inspectionId);
      if (p) p.itemCount++;
    }
    return {
      inspections: inspections.map((i) =>
        jobInspection(i, i.projectId ? byId.get(i.projectId) : null),
      ),
      projects,
      progress,
    };
  }, []);
  const [toDelete, setToDelete] = useState<JobInspection | null>(null);
  const [choosing, setChoosing] = useState(false);

  async function start(projectId: string | null) {
    setChoosing(false);
    const inspection = await createInspection(db, new Date(), projectId);
    rememberBack(`inspection:${inspection.id}`, "/");
    // A new inspection starts with its job details.
    navigate(tabPath(inspection.id, "details"));
  }

  const recent = data?.inspections.slice(0, RECENT) ?? [];
  // Inspections still needing a project stay in view even when older.
  const olderUnsorted =
    data?.inspections.slice(RECENT).filter((i) => !i.projectId) ?? [];

  return (
    <section className="home">
      <div className="page-heading">
        <h1>Inspections</h1>
        <button
          type="button"
          className="primary"
          onClick={() => setChoosing(true)}
        >
          <Plus aria-hidden="true" /> New inspection
        </button>
      </div>

      {data && (
        <div className="home-columns">
          <section className="home-column" aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="section-title">
              <Clock aria-hidden="true" /> Recent inspections
            </h2>
            {recent.length === 0 ? (
              <p className="empty-state">No inspections yet</p>
            ) : (
              <ul className="inspection-list" aria-label="Recent inspections">
                {recent.map((inspection) => (
                  <InspectionCard
                    key={inspection.id}
                    inspection={inspection}
                    progress={data.progress.get(inspection.id)}
                    onDelete={setToDelete}
                  />
                ))}
              </ul>
            )}
            {olderUnsorted.length > 0 && (
              <>
                <h3 className="section-subtitle">Also needing a project</h3>
                <ul className="inspection-list" aria-label="Needs a project">
                  {olderUnsorted.map((inspection) => (
                    <InspectionCard
                      key={inspection.id}
                      inspection={inspection}
                      progress={data.progress.get(inspection.id)}
                      onDelete={setToDelete}
                    />
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="home-column" aria-labelledby="projects-heading">
            <h2 id="projects-heading" className="section-title">
              <Building2 aria-hidden="true" /> Projects
            </h2>
            <ProjectsList
              projects={data.projects}
              inspections={data.inspections}
              search={search}
              onSearch={setSearch}
            />
          </section>
        </div>
      )}

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

/** One inspection: what was inspected, its job and date, and its status. */
export function InspectionCard({
  inspection,
  progress,
  onDelete,
  from = "/",
}: {
  inspection: JobInspection;
  progress?: InspectionProgress;
  onDelete?: (inspection: JobInspection) => void;
  /** The screen it's listed on, where its back button returns. */
  from?: string;
}) {
  const what = inspection.itemInspected.trim() || "Untitled inspection";
  return (
    <li className="inspection-card">
      <Link
        to={
          inspection.projectId
            ? `/inspections/${inspection.id}`
            : tabPath(inspection.id, "details")
        }
        className="inspection-card-link"
        onClick={() => rememberBack(`inspection:${inspection.id}`, from)}
      >
        <span className="inspection-card-title">{what}</span>
        <span>
          {[
            inspection.projectId ? inspectionTitle(inspection) : null,
            inspection.client.company,
            formatLongDate(inspection.date),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="muted small">
          Edited {formatDateTime(inspection.updatedAt)}
        </span>
      </Link>
      <StatusChip inspection={inspection} progress={progress} />
      {onDelete && (
        <button
          type="button"
          className="icon-button danger-outline"
          aria-label={`Delete ${inspectionTitle(inspection)}, ${what}`}
          title="Delete inspection"
          onClick={() => onDelete(inspection)}
        >
          <Trash2 aria-hidden="true" />
        </button>
      )}
    </li>
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
      <label className="search-box">
        <Search aria-hidden="true" />
        <input
          type="search"
          aria-label="Find a project"
          value={search}
          placeholder="Find a project"
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
        <ul className="project-list" aria-label="Projects">
          {listed.map((p) => {
            const count = counts.get(p.id) ?? 0;
            return (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="project-row"
                  onClick={() => rememberBack(`project:${p.id}`, "/")}
                >
                  <ProjectAvatar project={p} />
                  <span className="project-row-text">
                    <span className="inspection-card-title">
                      {inspectionTitle(p)}
                    </span>
                    <span className="muted small">
                      {[
                        p.client.company,
                        `${count} inspection${count === 1 ? "" : "s"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="row-chevron" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
