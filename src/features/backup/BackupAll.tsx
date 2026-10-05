import { useLiveQuery } from "dexie-react-hooks";
import { CloudUpload } from "lucide-react";
import { useState } from "react";
import { needsBackup } from "../../db/backup";
import { db } from "../../db/db";
import { formatBytes } from "../../db/storage";
import { saveFiles } from "../photos/savePhotos";
import { buildBackupFile, recordBackups } from "./backupActions";

type State =
  | { status: "idle" }
  | { status: "building"; done: number; total: number }
  | { status: "ready"; files: File[]; ids: string[] }
  | { status: "error"; message: string };

/**
 * Settings, Storage: one inspection file per inspection, shared together
 * (Save to Files, then a folder). Working copies of photos only; camera
 * originals are an option per inspection on Pre-inspection.
 */
export function BackupAll() {
  const inspections = useLiveQuery(() => db.inspections.toArray(), []);
  const [state, setState] = useState<State>({ status: "idle" });
  if (!inspections) return null;
  const stale = inspections.filter(needsBackup).length;

  async function build() {
    const ids = (inspections ?? []).map((i) => i.id);
    const files: File[] = [];
    try {
      for (const [i, id] of ids.entries()) {
        setState({ status: "building", done: i, total: ids.length });
        files.push(await buildBackupFile(id, false));
      }
      setState({ status: "ready", files, ids });
    } catch (e) {
      console.error("Backup failed", e);
      setState({
        status: "error",
        message: "The backup couldn't be made. Try again.",
      });
    }
  }

  async function share(files: File[], ids: string[]) {
    const result = await saveFiles(files);
    if (result !== "cancelled") {
      await recordBackups(ids);
      setState({ status: "idle" });
    }
  }

  if (inspections.length === 0)
    return <p className="muted small">No inspections to back up yet.</p>;

  return (
    <div className="backup-all" data-testid="backup-all">
      <p className="muted small">
        {stale === 0
          ? "Every inspection is backed up."
          : `${stale} of ${inspections.length} inspections changed since their last backup.`}
      </p>
      {state.status === "error" && (
        <p role="alert" className="error">
          {state.message}
        </p>
      )}
      {state.status === "ready" ? (
        <p className="button-row">
          <button
            type="button"
            className="emphasis"
            onClick={() => void share(state.files, state.ids)}
          >
            Share {state.files.length} files…
          </button>
          <span className="muted small">
            {formatBytes(state.files.reduce((n, f) => n + f.size, 0))}. Choose
            Save to Files, then a folder.
          </span>
        </p>
      ) : (
        <p className="button-row">
          <button
            type="button"
            className="primary"
            disabled={state.status === "building"}
            onClick={() => void build()}
          >
            <CloudUpload aria-hidden="true" />{" "}
            {state.status === "building"
              ? `Preparing ${state.done + 1} of ${state.total}…`
              : `Back up all (${inspections.length} ${inspections.length === 1 ? "inspection" : "inspections"})`}
          </button>
        </p>
      )}
    </div>
  );
}
