import { useState } from "react";
import { Link } from "react-router";
import { db } from "../../db/db";
import { missingJobFields } from "../../db/inspections";
import { createMemo } from "../../db/memos";
import type { JobInspection } from "../../db/types";
import { tabPath } from "../inspections/tabPath";

/**
 * Site memo tab before there is a memo: Create memo gives it the job's
 * next SIM reference (the tab then shows the editor). A memo needs a job
 * number and job name first.
 */
export function CreateMemo({ inspection }: { inspection: JobInspection }) {
  const [error, setError] = useState<string | null>(null);
  const hasProject = inspection.projectId !== null;
  const canCreate = hasProject && missingJobFields(inspection).length === 0;

  return (
    <div aria-labelledby="memo-heading">
      <h2 id="memo-heading">Site Instruction Memo</h2>
      <p className="muted">
        The Site Instruction Memo, editable before export. Its instructions come
        from the pins.
      </p>
      <p className="button-row">
        <button
          type="button"
          className="primary"
          disabled={!canCreate}
          onClick={() => {
            setError(null);
            void createMemo(db, inspection.id).catch((e: unknown) => {
              console.error("Creating the memo failed", e);
              setError("The memo couldn't be created. Try again.");
            });
          }}
        >
          Create memo
        </button>
      </p>
      {!hasProject && (
        <p className="muted">
          Put this inspection in a project first, on{" "}
          <Link to={tabPath(inspection.id, "details")}>Pre-inspection</Link>.
        </p>
      )}
      {hasProject && !canCreate && (
        <p className="muted">
          Add a job number and job name on{" "}
          <Link to={tabPath(inspection.id, "details")}>Pre-inspection</Link>{" "}
          first.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
