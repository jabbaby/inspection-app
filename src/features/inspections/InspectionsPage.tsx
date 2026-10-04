import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { rememberBack } from "../../app/backTarget";
import { SwipeToDelete } from "../../app/SwipeToDelete";
import { db } from "../../db/db";
import { deleteInspection } from "../../db/inspections";
import { jobInspection } from "../../db/projects";
import type { JobInspection, Project } from "../../db/types";
import { formatLongDate } from "../../lib/dates";
import { ProjectAvatar } from "../projects/ProjectAvatar";
import { matchesSearch } from "../projects/projectSearch";
import { DeleteInspectionDialog } from "./DeleteInspectionDialog";
import {
  groupByWeek,
  inspectionMatches,
  progressByInspection,
  titleOf,
  type InspectionProgress,
} from "./homeData";
import {
  InspectionAvatar,
  InspectionLink,
  NewInspectionButton,
  NewProjectButton,
  StatusChip,
} from "./inspectionParts";
import { inspectionTitle } from "./inspectionTitle";

/** How many inspections Recent shows. */
const RECENT = 10;
/** Where this page's links say back goes. */
const HERE = "/inspections";

/**
 * Inspections (SPEC section 12): search, recent inspections (swipe a row
 * left to delete it, after a confirm) and projects.
 */
export function InspectionsPage() {
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<JobInspection | null>(null);
  const data = useLiveQuery(async () => {
    const [inspections, projects, memos, items, drawings] = await Promise.all([
      db.inspections.orderBy("updatedAt").reverse().toArray(),
      db.projects.toArray(),
      db.memos.toArray(),
      db.items.toArray(),
      db.drawings.toArray(),
    ]);
    const byId = new Map(projects.map((p) => [p.id, p]));
    return {
      inspections: inspections.map((i) =>
        jobInspection(i, i.projectId ? byId.get(i.projectId) : null),
      ),
      projects,
      progress: progressByInspection(inspections, memos, items, drawings),
    };
  }, []);

  if (!data) return null;

  const searching = search.trim() !== "";
  const matching = data.inspections.filter((i) => inspectionMatches(i, search));
  const recent = searching ? matching : matching.slice(0, RECENT);
  // Inspections still needing a project stay in view even when older.
  const olderUnsorted = searching
    ? []
    : data.inspections.slice(RECENT).filter((i) => !i.projectId);

  const row = (inspection: JobInspection) => (
    <SwipeToDelete
      key={inspection.id}
      label={`Delete ${titleOf(inspection)}`}
      onDelete={() => setToDelete(inspection)}
    >
      <RecentRow
        inspection={inspection}
        progress={data.progress.get(inspection.id)}
      />
    </SwipeToDelete>
  );

  return (
    <section className="home">
      <header className="home-head">
        <div className="home-hello">
          <h1>Inspections</h1>
        </div>
        <label className="search-box home-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            aria-label="Search inspections and projects"
            value={search}
            placeholder="Search inspections and jobs"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <NewInspectionButton from={HERE} />
      </header>

      <div className="home-lower">
        <section className="tile tile-list" aria-labelledby="recent-heading">
          <div className="tile-head">
            <h2 id="recent-heading" className="eyebrow">
              {searching ? "Matching inspections" : "Recent inspections"}
            </h2>
            {!searching && recent.length > 0 && (
              <span className="chip">Swipe left to delete</span>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="list-empty">
              {searching ? "No inspections match." : "No inspections yet"}
            </p>
          ) : (
            <>
              <div className="recent-columns" aria-hidden="true">
                <span>Inspection</span>
                <span>Project</span>
                <span>Date</span>
                <span>Status</span>
              </div>
              <ul className="recent-table" aria-label="Recent inspections">
                {groupByWeek(recent).map((group) => (
                  <GroupRows key={group.label} label={group.label}>
                    {group.inspections.map(row)}
                  </GroupRows>
                ))}
              </ul>
            </>
          )}
          {olderUnsorted.length > 0 && (
            <>
              <h3 className="eyebrow home-subhead">Also needing a project</h3>
              <ul className="recent-table" aria-label="Needs a project">
                {olderUnsorted.map(row)}
              </ul>
            </>
          )}
        </section>

        <ProjectsTile
          projects={data.projects}
          inspections={data.inspections}
          search={search}
        />
      </div>

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

/** A labelled run of rows inside one list (e.g. This week). */
function GroupRows({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <li className="list-group-label" role="presentation">
        {label}
      </li>
      {children}
    </>
  );
}

/** One recent inspection as a table row: what, project and client, date, status. */
function RecentRow({
  inspection,
  progress,
}: {
  inspection: JobInspection;
  progress?: InspectionProgress;
}) {
  return (
    <InspectionLink inspection={inspection} from={HERE} className="recent-row">
      <span className="recent-what">
        <InspectionAvatar inspection={inspection} />
        <span className="list-row-title">{titleOf(inspection)}</span>
      </span>
      <span className="recent-project">
        <span className="list-row-meta">
          {inspection.projectId ? inspectionTitle(inspection) : "No project"}
        </span>
        {inspection.client.company && (
          <span className="list-row-meta small">
            {inspection.client.company}
          </span>
        )}
      </span>
      <span className="list-row-meta">{formatLongDate(inspection.date)}</span>
      <span>
        <StatusChip inspection={inspection} progress={progress} />
      </span>
    </InspectionLink>
  );
}

/**
 * One inspection as a row (the project page): its project badge, what was
 * inspected, the job and date, and its status.
 */
export function InspectionCard({
  inspection,
  progress,
  from,
}: {
  inspection: JobInspection;
  progress?: InspectionProgress;
  /** The screen it's listed on, where its back button returns. */
  from: string;
}) {
  return (
    <li>
      <InspectionLink
        inspection={inspection}
        from={from}
        className="list-row inspection-row"
      >
        <InspectionAvatar inspection={inspection} />
        <span className="list-row-main">
          <span className="list-row-title">{titleOf(inspection)}</span>
          <span className="list-row-meta">
            {[
              inspection.projectId ? inspectionTitle(inspection) : null,
              inspection.client.company,
              formatLongDate(inspection.date),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {progress && <StatusChip inspection={inspection} progress={progress} />}
        <ChevronRight aria-hidden="true" className="row-chevron" />
      </InspectionLink>
    </li>
  );
}

function ProjectsTile({
  projects,
  inspections,
  search,
}: {
  projects: Project[];
  inspections: JobInspection[];
  search: string;
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
  const activity = (p: Project) => Math.max(p.updatedAt, latest.get(p.id) ?? 0);
  const listed = projects
    .filter((p) => matchesSearch(p, search))
    .sort((a, b) => activity(b) - activity(a));

  return (
    <section className="tile tile-list" aria-labelledby="projects-heading">
      <div className="tile-head">
        <h2 id="projects-heading" className="eyebrow">
          Projects
        </h2>
        <NewProjectButton from={HERE} />
      </div>
      {listed.length === 0 ? (
        <p className="list-empty">
          {projects.length ? "No projects match." : "No projects yet"}
        </p>
      ) : (
        <ul className="side-list" aria-label="Projects">
          {listed.map((p) => {
            const count = counts.get(p.id) ?? 0;
            return (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="list-row"
                  onClick={() => rememberBack(`project:${p.id}`, HERE)}
                >
                  <ProjectAvatar project={p} />
                  <span className="list-row-main">
                    <span className="list-row-title">{inspectionTitle(p)}</span>
                    <span className="list-row-meta">
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
    </section>
  );
}
