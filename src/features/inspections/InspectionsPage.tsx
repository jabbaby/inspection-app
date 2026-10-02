import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { appCommit, appVersion } from "../../app/version";
import { db } from "../../db/db";
import { createInspection, deleteInspection } from "../../db/inspections";
import type { Inspection } from "../../db/types";
import { formatDateTime, formatLongDate } from "../../lib/dates";
import { DeleteInspectionDialog } from "./DeleteInspectionDialog";
import { tabPath } from "./tabPath";
import { inspectionTitle } from "./inspectionTitle";

export function InspectionsPage() {
  const navigate = useNavigate();
  const inspections = useLiveQuery(
    () => db.inspections.orderBy("updatedAt").reverse().toArray(),
    [],
  );
  const [toDelete, setToDelete] = useState<Inspection | null>(null);
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const inspection = await createInspection(db);
      // A new inspection starts with its job details.
      navigate(tabPath(inspection.id, "details"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <h1>Inspections</h1>
        <button
          type="button"
          className="primary"
          onClick={() => void create()}
          disabled={creating}
        >
          New inspection
        </button>
      </div>

      {inspections === undefined ? null : inspections.length === 0 ? (
        <p className="empty-state">No inspections yet</p>
      ) : (
        <ul className="inspection-list" aria-label="Inspections">
          {inspections.map((inspection) => (
            <li key={inspection.id} className="inspection-card">
              <Link
                to={`/inspections/${inspection.id}`}
                className="inspection-card-link"
              >
                <span className="inspection-card-title">
                  {inspectionTitle(inspection)}
                </span>
                <span>
                  {[inspection.client.company, formatLongDate(inspection.date)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="muted">
                  Edited {formatDateTime(inspection.updatedAt)}
                </span>
              </Link>
              <button
                type="button"
                className="danger-outline"
                aria-label={`Delete ${inspectionTitle(inspection)}`}
                onClick={() => setToDelete(inspection)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="app-version">
        Version {appVersion} ({appCommit})
      </p>

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
