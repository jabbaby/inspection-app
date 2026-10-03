import { useLiveQuery } from "dexie-react-hooks";
import {
  Check,
  ChevronRight,
  ClipboardPlus,
  Database,
  Files,
  FolderSearch,
  Images,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { rememberBack } from "../../app/backTarget";
import { appCommit, appVersion } from "../../app/version";
import { db } from "../../db/db";
import { createInspection } from "../../db/inspections";
import { createProject, jobInspection } from "../../db/projects";
import {
  formatBytes,
  getStorageStatus,
  type StorageStatus,
} from "../../db/storage";
import { SETTINGS_ID, type JobInspection, type Project } from "../../db/types";
import { formatLongDate } from "../../lib/dates";
import { ProjectAvatar } from "../projects/ProjectAvatar";
import { ProjectPicker } from "../projects/ProjectPicker";
import { matchesSearch } from "../projects/projectSearch";
import {
  editedAgo,
  emptyProgress,
  greeting,
  groupByWeek,
  inspectionMatches,
  longToday,
  monthStats,
  needsAttention,
  nextStep,
  progressByInspection,
  stepsDone,
  type InspectionProgress,
} from "./homeData";
import { inspectionTitle } from "./inspectionTitle";
import { tabPath, type InspectionTab } from "./tabPath";

/** How many inspections Recent shows. */
const RECENT = 10;

/**
 * Inspections home (SPEC section 12): a greeting, the inspection to carry
 * on with, what needs attention, recent inspections and projects. New
 * inspection asks for its project first.
 */
export function InspectionsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [choosing, setChoosing] = useState<"inspection" | "project" | null>(
    null,
  );
  const data = useLiveQuery(async () => {
    const [inspections, projects, memos, items, drawings, settings] =
      await Promise.all([
        db.inspections.orderBy("updatedAt").reverse().toArray(),
        db.projects.toArray(),
        db.memos.toArray(),
        db.items.toArray(),
        db.drawings.toArray(),
        db.settings.get(SETTINGS_ID),
      ]);
    const byId = new Map(projects.map((p) => [p.id, p]));
    return {
      inspections: inspections.map((i) =>
        jobInspection(i, i.projectId ? byId.get(i.projectId) : null),
      ),
      projects,
      progress: progressByInspection(inspections, memos, items, drawings),
      month: monthStats(inspections, memos, items),
      name: settings?.inspectorName ?? "",
    };
  }, []);

  async function start(projectId: string | null) {
    setChoosing(null);
    const inspection = await createInspection(db, new Date(), projectId);
    rememberBack(`inspection:${inspection.id}`, "/");
    // A new inspection starts with its job details.
    navigate(tabPath(inspection.id, "details"));
  }

  const newInspection = (
    <button
      type="button"
      className="primary"
      onClick={() => setChoosing("inspection")}
    >
      <Plus aria-hidden="true" /> New inspection
    </button>
  );

  const pickers = (
    <ProjectPicker
      open={choosing !== null}
      title={choosing === "project" ? "New project" : "New inspection"}
      mode={choosing === "project" ? "new" : "both"}
      onPick={(projectId) => void start(projectId)}
      onCreate={async (details) => {
        const project = await createProject(db, details);
        if (choosing === "project") {
          setChoosing(null);
          rememberBack(`project:${project.id}`, "/");
          navigate(`/projects/${project.id}`);
        } else await start(project.id);
      }}
      onSkip={choosing === "inspection" ? () => void start(null) : undefined}
      onCancel={() => setChoosing(null)}
    />
  );

  if (!data) return null;

  if (data.inspections.length === 0 && data.projects.length === 0)
    return (
      <section className="home">
        <div className="empty-state home-first-run">
          <span className="empty-state-icon">
            <ClipboardPlus aria-hidden="true" />
          </span>
          <h1>Start your first inspection</h1>
          <p className="muted">
            Pick or create the project, add the drawing PDFs, then drop pins on
            site. Everything stays on this iPad.
          </p>
          {newInspection}
        </div>
        <p className="app-version home-version">
          Version {appVersion} ({appCommit})
        </p>
        {pickers}
      </section>
    );

  const searching = search.trim() !== "";
  const matching = data.inspections.filter((i) => inspectionMatches(i, search));
  const recent = searching ? matching : matching.slice(0, RECENT);
  // Inspections still needing a project stay in view even when older.
  const olderUnsorted = searching
    ? []
    : data.inspections.slice(RECENT).filter((i) => !i.projectId);
  const latest = data.inspections[0];
  const attention = needsAttention(data.inspections, data.progress);

  return (
    <section className="home">
      <header className="home-head">
        <div className="home-hello">
          <p className="muted">{longToday()}</p>
          <h1>{greeting(data.name)}</h1>
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
        {newInspection}
      </header>

      <div className="home-columns">
        <div className="home-main">
          {!searching && latest && (
            <ContinueCard
              inspection={latest}
              progress={data.progress.get(latest.id) ?? emptyProgress()}
            />
          )}

          {!searching && attention.length > 0 && (
            <section aria-labelledby="attention-heading">
              <h2 id="attention-heading" className="eyebrow">
                Needs attention · {attention.length}
              </h2>
              <ul className="attention-grid" aria-label="Needs attention">
                {attention.map((a) => (
                  <li key={a.inspection.id}>
                    <InspectionLink
                      inspection={a.inspection}
                      tab={a.tab}
                      className={`attention-card tone-${a.tone}`}
                    >
                      <span className="attention-icon">
                        {a.tone === "danger" ? (
                          <FolderSearch aria-hidden="true" />
                        ) : (
                          <TriangleAlert aria-hidden="true" />
                        )}
                      </span>
                      <span className="list-row-main">
                        <span className="list-row-title">
                          {titleOf(a.inspection)}
                        </span>
                        <span className="attention-reason">{a.reason}</span>
                      </span>
                    </InspectionLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="eyebrow">
              {searching ? "Matching inspections" : "Recent inspections"}
            </h2>
            {recent.length === 0 ? (
              <p className="list-empty">
                {searching ? "No inspections match." : "No inspections yet"}
              </p>
            ) : (
              <ul className="list-panel" aria-label="Recent inspections">
                {groupByWeek(recent).map((group) => (
                  <GroupRows key={group.label} label={group.label}>
                    {group.inspections.map((inspection) => (
                      <InspectionCard
                        key={inspection.id}
                        inspection={inspection}
                        progress={data.progress.get(inspection.id)}
                      />
                    ))}
                  </GroupRows>
                ))}
              </ul>
            )}
            {olderUnsorted.length > 0 && (
              <>
                <h3 className="eyebrow home-subhead">Also needing a project</h3>
                <ul className="list-panel" aria-label="Needs a project">
                  {olderUnsorted.map((inspection) => (
                    <InspectionCard
                      key={inspection.id}
                      inspection={inspection}
                      progress={data.progress.get(inspection.id)}
                    />
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        <aside className="home-side">
          <ProjectsPanel
            projects={data.projects}
            inspections={data.inspections}
            search={search}
            onNew={() => setChoosing("project")}
          />
          {!searching && <MonthCard month={data.month} />}
          {!searching && <StorageCard />}
        </aside>
      </div>

      <p className="app-version home-version">
        Version {appVersion} ({appCommit})
      </p>
      {pickers}
    </section>
  );
}

/** "Level 3 slab reinforcement", or a placeholder. */
function titleOf(inspection: JobInspection) {
  return inspection.itemInspected.trim() || "Untitled inspection";
}

/** Opens an inspection's step; its back button returns here. */
function InspectionLink({
  inspection,
  tab,
  className,
  children,
}: {
  inspection: JobInspection;
  tab: InspectionTab;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={tabPath(inspection.id, tab)}
      className={className}
      onClick={() => rememberBack(`inspection:${inspection.id}`, "/")}
    >
      {children}
    </Link>
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

/** The inspection edited last: where it's got to and the next step. */
function ContinueCard({
  inspection,
  progress,
}: {
  inspection: JobInspection;
  progress: InspectionProgress;
}) {
  const done = stepsDone(inspection, progress);
  const next = nextStep(inspection, progress);
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`;
  return (
    <section className="card continue-card" aria-labelledby="continue-heading">
      <p className="eyebrow" id="continue-heading">
        Continue where you left off · edited {editedAgo(inspection.updatedAt)}
      </p>
      <div className="continue-title">
        <InspectionAvatar inspection={inspection} large />
        <div className="list-row-main">
          <h2>{titleOf(inspection)}</h2>
          <span className="list-row-meta">
            {[
              inspection.projectId ? inspectionTitle(inspection) : null,
              inspection.client.company,
            ]
              .filter(Boolean)
              .join(" · ") || "No project yet"}
          </span>
        </div>
      </div>
      <ol className="progress-steps" aria-label="Progress">
        {["Pre-inspection", "Inspection", "Site memo"].map((label, i) => (
          <li key={label} className={done[i] ? "done" : undefined}>
            <span className="progress-bar" />
            <span className="progress-label">
              {done[i] && <Check aria-hidden="true" />}
              {label}
              <span className="sr-only">{done[i] ? ", done" : ", to do"}</span>
            </span>
          </li>
        ))}
      </ol>
      <ul className="continue-stats" aria-label="Contents">
        <li>
          <Files aria-hidden="true" /> {plural(progress.drawings, "drawing")}
        </li>
        <li>
          <MapPin aria-hidden="true" className="tone-instruction" />{" "}
          {plural(progress.instructions, "instruction")}
        </li>
        <li>
          <MapPin aria-hidden="true" className="tone-observation" />{" "}
          {plural(progress.observations, "observation")}
        </li>
        <li>
          <Images aria-hidden="true" /> {plural(progress.photos, "photo")}
        </li>
      </ul>
      <div className="button-row">
        <InspectionLink
          inspection={inspection}
          tab={next.tab}
          className="button-link emphasis"
        >
          {next.label}
        </InspectionLink>
        {next.tab !== "inspection" && inspection.projectId && (
          <InspectionLink
            inspection={inspection}
            tab="inspection"
            className="button-link"
          >
            Open drawings
          </InspectionLink>
        )}
      </div>
    </section>
  );
}

/** The project's badge, or a plain one for an inspection without a project. */
function InspectionAvatar({
  inspection,
  large = false,
}: {
  inspection: JobInspection;
  large?: boolean;
}) {
  if (!inspection.projectId)
    return (
      <span
        className={`project-avatar avatar-none${large ? " avatar-large" : ""}`}
        aria-hidden="true"
      >
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
      large={large}
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

/**
 * One inspection as a row: its project badge, what was inspected, the job
 * and date, and its status. Opens on its Inspection step (Pre-inspection
 * while it needs a project).
 */
export function InspectionCard({
  inspection,
  progress,
  from = "/",
}: {
  inspection: JobInspection;
  progress?: InspectionProgress;
  /** The screen it's listed on, where its back button returns. */
  from?: string;
}) {
  return (
    <li>
      <Link
        to={
          inspection.projectId
            ? `/inspections/${inspection.id}`
            : tabPath(inspection.id, "details")
        }
        className="list-row inspection-row"
        onClick={() => rememberBack(`inspection:${inspection.id}`, from)}
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
      </Link>
    </li>
  );
}

function ProjectsPanel({
  projects,
  inspections,
  search,
  onNew,
}: {
  projects: Project[];
  inspections: JobInspection[];
  search: string;
  onNew: () => void;
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
    <section className="card side-card" aria-labelledby="projects-heading">
      <div className="side-card-head">
        <h2 id="projects-heading" className="eyebrow">
          Projects
        </h2>
        <button type="button" className="quiet small" onClick={onNew}>
          <Plus aria-hidden="true" /> New project
        </button>
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
                  onClick={() => rememberBack(`project:${p.id}`, "/")}
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

function MonthCard({
  month,
}: {
  month: { inspections: number; memos: number; items: number };
}) {
  return (
    <section className="card side-card" aria-labelledby="month-heading">
      <h2 id="month-heading" className="eyebrow">
        This month
      </h2>
      <dl className="stat-row">
        <div>
          <dt>Inspections</dt>
          <dd>{month.inspections}</dd>
        </div>
        <div>
          <dt>Memos</dt>
          <dd>{month.memos}</dd>
        </div>
        <div>
          <dt>Items</dt>
          <dd>{month.items}</dd>
        </div>
      </dl>
    </section>
  );
}

function StorageCard() {
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  useEffect(() => {
    void getStorageStatus().then(setStorage);
  }, []);
  if (!storage || storage.usage === undefined || !storage.quota) return null;
  const used = Math.min(100, (storage.usage / storage.quota) * 100);
  return (
    <section className="card side-card" aria-labelledby="storage-heading">
      <div className="side-card-head">
        <h2 id="storage-heading" className="eyebrow">
          <Database aria-hidden="true" /> Storage
        </h2>
        {storage.persisted !== undefined && (
          <span
            className={storage.persisted ? "storage-kept" : "storage-at-risk"}
          >
            {storage.persisted ? (
              <>
                <ShieldCheck aria-hidden="true" /> Kept by the iPad
              </>
            ) : (
              <>
                <ShieldAlert aria-hidden="true" /> May be cleared
              </>
            )}
          </span>
        )}
      </div>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${Math.max(used, 1)}%` }} />
      </div>
      <p className="muted small">
        {formatBytes(storage.usage)} used of {formatBytes(storage.quota)}
      </p>
    </section>
  );
}
