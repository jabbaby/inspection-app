import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardPlus,
  FileText,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { rememberBack } from "../../app/backTarget";
import { appCommit, appVersion } from "../../app/version";
import { northrop } from "../../brand/northrop";
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
import { DrawingThumb } from "./DrawingThumb";
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
  type Attention,
  type InspectionProgress,
} from "./homeData";
import { inspectionTitle } from "./inspectionTitle";
import { tabPath, type InspectionTab } from "./tabPath";

/** How many inspections Recent shows. */
const RECENT = 10;

/**
 * Inspections home (SPEC section 12): a greeting, then tiles (the
 * inspection to carry on with, this month's items and memos, what needs
 * attention, storage), recent inspections and projects. New inspection
 * asks for its project first.
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
    const latestMemo = [...memos].sort((a, b) => b.createdAt - a.createdAt)[0];
    return {
      inspections: inspections.map((i) =>
        jobInspection(i, i.projectId ? byId.get(i.projectId) : null),
      ),
      projects,
      progress: progressByInspection(inspections, memos, items, drawings),
      month: monthStats(inspections, memos, items),
      latestMemo: latestMemo?.reference ?? null,
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
          <img
            className="home-wordmark"
            src={northrop.assets.wordmarkRed}
            alt={northrop.name}
          />
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
  const attention = needsAttention(data.inspections, data.progress, 3);
  const attentionCount = needsAttention(
    data.inspections,
    data.progress,
    Infinity,
  ).length;

  return (
    <section className="home">
      <header className="home-head">
        <div className="home-hello">
          <img
            className="home-wordmark"
            src={northrop.assets.wordmarkRed}
            alt={northrop.name}
          />
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

      {!searching && (
        <div className="bento">
          {latest ? (
            <ContinueTile
              inspection={latest}
              progress={data.progress.get(latest.id) ?? emptyProgress()}
            />
          ) : (
            <section className="tile tile-continue tile-start">
              <p className="eyebrow">Get started</p>
              <h2>Start an inspection</h2>
              <p className="muted">Your projects are ready below.</p>
              {newInspection}
            </section>
          )}
          <NumberTile
            className="tile-warm"
            label="Items logged"
            value={data.month.items}
            note="this month"
            icon={<MapPin aria-hidden="true" />}
          />
          <AttentionTile attention={attention} count={attentionCount} />
          <NumberTile
            className="tile-plain"
            label="Memos this month"
            value={data.month.memos}
            note={
              data.latestMemo ? (
                <span className="chip chip-ok">Latest {data.latestMemo}</span>
              ) : (
                "None yet"
              )
            }
            icon={<FileText aria-hidden="true" />}
          />
          <StorageTile />
        </div>
      )}

      <div className="home-lower">
        <section className="tile tile-list" aria-labelledby="recent-heading">
          <div className="tile-head">
            <h2 id="recent-heading" className="eyebrow">
              {searching ? "Matching inspections" : "Recent inspections"}
            </h2>
            {!searching && <span className="chip">Last {RECENT} edited</span>}
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
                    {group.inspections.map((inspection) => (
                      <RecentRow
                        key={inspection.id}
                        inspection={inspection}
                        progress={data.progress.get(inspection.id)}
                      />
                    ))}
                  </GroupRows>
                ))}
              </ul>
            </>
          )}
          {olderUnsorted.length > 0 && (
            <>
              <h3 className="eyebrow home-subhead">Also needing a project</h3>
              <ul className="recent-table" aria-label="Needs a project">
                {olderUnsorted.map((inspection) => (
                  <RecentRow
                    key={inspection.id}
                    inspection={inspection}
                    progress={data.progress.get(inspection.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </section>

        <ProjectsTile
          projects={data.projects}
          inspections={data.inspections}
          search={search}
          onNew={() => setChoosing("project")}
        />
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

/** The inspection edited last: a preview of its drawing and the next step. */
function ContinueTile({
  inspection,
  progress,
}: {
  inspection: JobInspection;
  progress: InspectionProgress;
}) {
  const done = stepsDone(inspection, progress);
  const next = nextStep(inspection, progress);
  return (
    <section className="tile tile-continue" aria-labelledby="continue-heading">
      <div className="tile-head">
        <p className="eyebrow" id="continue-heading">
          Continue where you left off
        </p>
        <span className="chip">Edited {editedAgo(inspection.updatedAt)}</span>
      </div>
      <div className="continue-title">
        <InspectionAvatar inspection={inspection} />
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
      <DrawingThumb inspectionId={inspection.id} />
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
      <div className="continue-foot">
        <span className="muted small">
          {progress.instructions} instruction
          {progress.instructions === 1 ? "" : "s"} · {progress.observations}{" "}
          observation{progress.observations === 1 ? "" : "s"} ·{" "}
          {progress.photos} photo{progress.photos === 1 ? "" : "s"}
        </span>
        <InspectionLink
          inspection={inspection}
          tab={next.tab}
          className="button-link emphasis"
        >
          {next.label} <ArrowUpRight aria-hidden="true" />
        </InspectionLink>
      </div>
    </section>
  );
}

/** A tile with one big number. */
function NumberTile({
  className,
  label,
  value,
  note,
  icon,
}: {
  className: string;
  label: string;
  value: number;
  note: ReactNode;
  icon: ReactNode;
}) {
  return (
    <section className={`tile tile-number ${className}`}>
      <div className="tile-head">
        <h2 className="eyebrow">{label}</h2>
        <span className="tile-icon">{icon}</span>
      </div>
      <div className="tile-figure">
        <span className="big-number">{value}</span>
        <span className="tile-note">{note}</span>
      </div>
    </section>
  );
}

/** How many inspections need something, and the first few of them. */
function AttentionTile({
  attention,
  count,
}: {
  attention: Attention[];
  count: number;
}) {
  return (
    <section
      className="tile tile-number tile-dark"
      aria-labelledby="attention-heading"
    >
      <div className="tile-head">
        <h2 id="attention-heading" className="eyebrow">
          Needs attention
        </h2>
        <span className="tile-icon">
          {count ? (
            <ArrowUpRight aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
        </span>
      </div>
      {count === 0 ? (
        <div className="tile-figure">
          <span className="big-number">0</span>
          <span className="tile-note">All clear</span>
        </div>
      ) : (
        <>
          <span className="big-number">{count}</span>
          <ul className="attention-list" aria-label="Needs attention">
            {attention.map((a) => (
              <li key={a.inspection.id}>
                <InspectionLink
                  inspection={a.inspection}
                  tab={a.tab}
                  className={`attention-link tone-${a.tone}`}
                >
                  <span className="attention-dot" aria-hidden="true" />
                  <span className="attention-text">
                    {titleOf(a.inspection)}
                    <span className="attention-reason"> · {a.reason}</span>
                  </span>
                </InspectionLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Storage used, as a ring, and whether the iPad keeps the data. */
function StorageTile() {
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  useEffect(() => {
    void getStorageStatus().then(setStorage);
  }, []);
  const known = storage && storage.usage !== undefined && storage.quota;
  const used = known
    ? Math.min(100, (storage.usage! / storage.quota!) * 100)
    : 0;
  const r = 30;
  const length = 2 * Math.PI * r;
  return (
    <section
      className="tile tile-plain tile-storage"
      aria-labelledby="storage-heading"
    >
      <svg viewBox="0 0 76 76" className="storage-ring" aria-hidden="true">
        <circle cx="38" cy="38" r={r} className="ring-track" />
        <circle
          cx="38"
          cy="38"
          r={r}
          className="ring-value"
          strokeDasharray={`${Math.max((used / 100) * length, 2)} ${length}`}
          transform="rotate(-90 38 38)"
        />
      </svg>
      <div className="list-row-main">
        <h2 id="storage-heading" className="eyebrow">
          Storage
        </h2>
        <span className="storage-figure">
          {known ? formatBytes(storage.usage!) : "Not reported"}
        </span>
        {known && (
          <span className="muted small">of {formatBytes(storage.quota!)}</span>
        )}
        {storage?.persisted !== undefined && (
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
    </section>
  );
}

/** The project's badge, or a plain one for an inspection without a project. */
function InspectionAvatar({ inspection }: { inspection: JobInspection }) {
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

/** Where an inspection opens: its Inspection step, or Pre-inspection while it needs a project. */
function openPath(inspection: JobInspection) {
  return inspection.projectId
    ? `/inspections/${inspection.id}`
    : tabPath(inspection.id, "details");
}

/** One recent inspection as a table row: what, project, date, status. */
function RecentRow({
  inspection,
  progress,
}: {
  inspection: JobInspection;
  progress?: InspectionProgress;
}) {
  return (
    <li>
      <Link
        to={openPath(inspection)}
        className="recent-row"
        onClick={() => rememberBack(`inspection:${inspection.id}`, "/")}
      >
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
      </Link>
    </li>
  );
}

/**
 * One inspection as a row (the project page): its project badge, what was
 * inspected, the job and date, and its status.
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
        to={openPath(inspection)}
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

function ProjectsTile({
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
    <section className="tile tile-list" aria-labelledby="projects-heading">
      <div className="tile-head">
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
