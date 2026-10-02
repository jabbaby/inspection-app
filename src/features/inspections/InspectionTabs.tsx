import type { ReactNode } from "react";
import { Link } from "react-router";
import { tabPath, type InspectionTab } from "./tabPath";

const TABS: { key: InspectionTab; label: string }[] = [
  { key: "details", label: "Pre-inspection" },
  { key: "inspection", label: "Inspection" },
  { key: "memo", label: "Site memo" },
];

/** Pre-inspection | Inspection | Site memo (SPEC section 12). */
export function InspectionTabs({
  inspectionId,
  current,
}: {
  inspectionId: string;
  current: InspectionTab;
}) {
  return (
    <nav className="inspection-tabs" aria-label="Inspection sections">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          to={tabPath(inspectionId, tab.key)}
          aria-current={tab.key === current ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** "‹ Inspections", the inspection's title, then its tabs. */
export function InspectionHeader({
  inspectionId,
  title,
  current,
  status,
}: {
  inspectionId: string;
  title: string;
  current: InspectionTab;
  /** E.g. the save state, shown beside the title. */
  status?: ReactNode;
}) {
  return (
    <header className="inspection-header">
      <p>
        <Link to="/">‹ Inspections</Link>
      </p>
      <div className="page-heading">
        <h1 data-testid="inspection-title">{title}</h1>
        {status}
      </div>
      <InspectionTabs inspectionId={inspectionId} current={current} />
    </header>
  );
}
