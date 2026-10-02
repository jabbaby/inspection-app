import { ConfirmDialog } from "../../app/ConfirmDialog";
import type { JobInspection } from "../../db/types";
import { inspectionTitle } from "./inspectionTitle";

interface Props {
  inspection: JobInspection | null;
  onConfirm: (inspection: JobInspection) => void;
  onCancel: () => void;
}

export function DeleteInspectionDialog({
  inspection,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <ConfirmDialog
      open={inspection !== null}
      title="Delete inspection?"
      confirmLabel="Delete"
      danger
      onConfirm={() => inspection && onConfirm(inspection)}
      onCancel={onCancel}
    >
      <p>
        <strong>{inspection ? inspectionTitle(inspection) : ""}</strong> and
        everything in it (drawings, items, photos and memos) will be removed
        from this device.
      </p>
      <p>This can't be undone. Backups arrive in a later build.</p>
    </ConfirmDialog>
  );
}
