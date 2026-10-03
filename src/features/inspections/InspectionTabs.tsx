import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Check } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { db } from "../../db/db";
import { missingJobFields } from "../../db/inspections";
import { getMemo } from "../../db/memos";
import { loadJobInspection } from "../../db/projects";
import { inspectionTitle } from "./inspectionTitle";
import { tabPath, type InspectionTab } from "./tabPath";

type Tone = "ok" | "todo" | "danger" | "plain";

interface Step {
  key: InspectionTab;
  label: string;
  status: string;
  tone: Tone;
  done: boolean;
}

/** Each step's status line, from the inspection as saved. */
function useSteps(inspectionId: string): Step[] | undefined {
  return useLiveQuery(async () => {
    const [job, drawings, items, memo] = await Promise.all([
      loadJobInspection(db, inspectionId),
      db.drawings.where("inspectionId").equals(inspectionId).count(),
      db.items.where("inspectionId").equals(inspectionId).count(),
      getMemo(db, inspectionId),
    ]);
    if (!job) return undefined;
    const detailsDone = !!job.projectId && missingJobFields(job).length === 0;
    const plural = (n: number, word: string) =>
      `${n} ${word}${n === 1 ? "" : "s"}`;
    return [
      {
        key: "details",
        label: "Pre-inspection",
        status: !job.projectId
          ? "Needs a project"
          : detailsDone
            ? "Job details done"
            : "Job number and name needed",
        tone: !job.projectId ? "danger" : detailsDone ? "ok" : "todo",
        done: detailsDone,
      },
      {
        key: "inspection",
        label: "Inspection",
        status: drawings
          ? `${plural(drawings, "drawing")} · ${plural(items, "item")}`
          : "Add drawings",
        tone: items ? "ok" : "plain",
        done: items > 0,
      },
      {
        key: "memo",
        label: "Site memo",
        status: memo ? memo.reference : "Not started",
        tone: memo ? "ok" : "plain",
        done: !!memo,
      },
    ];
  }, [inspectionId]);
}

const STEPS: { key: InspectionTab; label: string }[] = [
  { key: "details", label: "Pre-inspection" },
  { key: "inspection", label: "Inspection" },
  { key: "memo", label: "Site memo" },
];

/**
 * The inspection's three steps (SPEC section 12): Pre-inspection,
 * Inspection, Site memo, each with how far it has got. Compact (one line,
 * no status) above the drawings, where space matters.
 */
export function InspectionTabs({
  inspectionId,
  current,
  compact = false,
}: {
  inspectionId: string;
  current: InspectionTab;
  compact?: boolean;
}) {
  const steps = useSteps(inspectionId);
  return (
    <nav
      className={`step-bar${compact ? " step-bar-compact" : ""}`}
      aria-label="Inspection sections"
    >
      {STEPS.map((base, i) => {
        const step = steps?.[i];
        const isCurrent = base.key === current;
        return (
          <Link
            key={base.key}
            to={tabPath(inspectionId, base.key)}
            aria-label={base.label}
            aria-current={isCurrent ? "page" : undefined}
            className="step"
            data-tone={step?.tone ?? "plain"}
          >
            <span className={`step-number${step?.done ? " step-done" : ""}`}>
              {step?.done && !isCurrent ? <Check aria-hidden="true" /> : i + 1}
            </span>
            <span className="step-text">
              <span className="step-label">{base.label}</span>
              {!compact && step && (
                <span
                  className="step-status"
                  data-testid={`step-status-${base.key}`}
                >
                  {step.status}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Back to Inspections, the job and item inspected, and the step bar. Stays
 * at the top while the page scrolls.
 */
export function InspectionHeader({
  inspectionId,
  title,
  current,
  status,
}: {
  inspectionId: string;
  /** Shown instead of the saved title (e.g. while job details are typed). */
  title?: string;
  current: InspectionTab;
  /** E.g. the save state, shown beside the title. */
  status?: ReactNode;
}) {
  const job = useLiveQuery(
    () => loadJobInspection(db, inspectionId),
    [inspectionId],
  );
  return (
    <header className="inspection-header">
      <div className="inspection-title-row">
        <Link to="/" className="back-link" aria-label="Back to inspections">
          <ArrowLeft aria-hidden="true" />
        </Link>
        <div className="inspection-title-text">
          <h1 data-testid="inspection-title">
            {title ?? (job ? inspectionTitle(job) : "")}
          </h1>
          {job?.itemInspected.trim() && (
            <span className="muted">{job.itemInspected}</span>
          )}
        </div>
        {status}
      </div>
      <InspectionTabs inspectionId={inspectionId} current={current} />
    </header>
  );
}

/** The compact header above the drawings: back, the job, and the steps. */
export function CompactInspectionHeader({
  inspectionId,
}: {
  inspectionId: string;
}) {
  const job = useLiveQuery(
    () => loadJobInspection(db, inspectionId),
    [inspectionId],
  );
  return (
    <header className="inspection-header inspection-header-compact">
      <Link to="/" className="back-link" aria-label="Back to inspections">
        <ArrowLeft aria-hidden="true" />
      </Link>
      <span className="compact-title" data-testid="inspection-title">
        {job ? inspectionTitle(job) : ""}
        {job?.itemInspected.trim() && (
          <span className="muted"> · {job.itemInspected}</span>
        )}
      </span>
      <InspectionTabs
        inspectionId={inspectionId}
        current="inspection"
        compact
      />
    </header>
  );
}
