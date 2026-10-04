import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "../../db/db";
import { getMemo } from "../../db/memos";
import type { Item } from "../../db/types";
import { changesSinceExport } from "./exportedLetters";

/** Exports already warned about this session (by export time). */
const warned = new Set<number>();

const SHOW_MS = 8000;

/**
 * Over the drawing: once per export, a short notice when letters change
 * after the memo was exported (deletes stay instant and undoable, so no
 * confirm). The Export card keeps the details until it is exported again.
 */
export function ExportedLettersNotice({
  inspectionId,
  items,
}: {
  inspectionId: string;
  items: Item[];
}) {
  const memo = useLiveQuery(() => getMemo(db, inspectionId), [inspectionId]);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const exportedAt = memo?.exportedAt;
  const changed =
    exportedAt !== undefined &&
    memo?.exportedLetters !== undefined &&
    changesSinceExport(memo.exportedLetters, items).length > 0;
  const visible =
    changed && dismissed !== exportedAt && !warned.has(exportedAt);

  useEffect(() => {
    if (!visible || exportedAt === undefined) return;
    const timer = window.setTimeout(() => {
      warned.add(exportedAt);
      setDismissed(exportedAt);
    }, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [visible, exportedAt]);

  if (!visible) return null;
  return (
    <button
      type="button"
      className="viewer-notice"
      role="status"
      data-testid="letters-changed-notice"
      onClick={() => {
        warned.add(exportedAt);
        setDismissed(exportedAt);
      }}
    >
      Letters changed after the memo was exported. Export again before sending.
    </button>
  );
}
