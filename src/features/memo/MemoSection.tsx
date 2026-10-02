import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { db } from "../../db/db";
import { createMemo, getMemo } from "../../db/memos";

/**
 * Inspection home: Create memo (gives it the job's next SIM reference) or
 * Open memo. A memo needs a job number and job name first.
 */
export function MemoSection({
  inspectionId,
  canCreate,
}: {
  inspectionId: string;
  canCreate: boolean;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const found = useLiveQuery(
    async () => ({ memo: (await getMemo(db, inspectionId)) ?? null }),
    [inspectionId],
  );
  if (!found) return null;
  const { memo } = found;
  const editor = `/inspections/${inspectionId}/memo`;

  return (
    <div className="later-section" aria-labelledby="memo-heading">
      <h2 id="memo-heading">Memo</h2>
      {memo ? (
        <p className="button-row">
          <span data-testid="memo-reference">
            {memo.reference} · Site Instruction Memo
          </span>
          <Link className="button-link" to={editor}>
            Open memo
          </Link>
        </p>
      ) : (
        <>
          <p className="muted">
            The Site Instruction Memo, editable before export. Its instructions
            come from the pins.
          </p>
          <p className="button-row">
            <button
              type="button"
              className="primary"
              disabled={!canCreate}
              onClick={() => {
                setError(null);
                void createMemo(db, inspectionId).then(
                  () => navigate(editor),
                  (e: unknown) => {
                    console.error("Creating the memo failed", e);
                    setError("The memo couldn't be created. Try again.");
                  },
                );
              }}
            >
              Create memo
            </button>
          </p>
          {!canCreate && (
            <p className="muted">Add a job number and job name first.</p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
