import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { FilePlus, Files, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../app/ConfirmDialog";
import { db } from "../../db/db";
import {
  addDrawing,
  listDrawings,
  deleteDrawing,
  drawingNameFromFile,
  renameDrawing,
} from "../../db/drawings";
import type { Drawing } from "../../db/types";
import { formatBytes } from "../../db/storage";

/** Opens the PDF to check it and count its pages, then stores it. */
async function storePdf(inspectionId: string, name: string, bytes: Uint8Array) {
  const { loadPdf } = await import("./pdf/pdfjs");
  // pdf.js takes ownership of the buffer it is given, so pass a copy.
  const pdf = await loadPdf(bytes.slice());
  const pageCount = pdf.numPages;
  const { measurePageSizes } = await import("./pdf/pageSizes");
  const pageSizes = await measurePageSizes(pdf);
  await pdf.loadingTask.destroy();
  await addDrawing(db, inspectionId, {
    name,
    pdf: bytes,
    pageCount,
    pageSizes,
  });
}

/**
 * An inspection's drawings: add (PDFs from Files, or a synthetic test
 * drawing), rename and delete. In the viewer's Drawings panel, tapping a
 * drawing scrolls to it (`onOpen`); with no drawings yet it fills the view.
 */
export function DrawingsSection({
  inspectionId,
  onOpen,
  onActivity,
}: {
  inspectionId: string;
  onOpen?: (drawingId: string) => void;
  /** Reports adding in progress, and whether any file failed. */
  onActivity?: (state: { busy: boolean; failed: boolean }) => void;
}) {
  const drawings = useLiveQuery(
    () => listDrawings(db, inspectionId),
    [inspectionId],
  );
  const counts = useLiveQuery(async () => {
    const items = await db.items
      .where("inspectionId")
      .equals(inspectionId)
      .toArray();
    const byDrawing = new Map<string, number>();
    for (const item of items)
      byDrawing.set(item.drawingId, (byDrawing.get(item.drawingId) ?? 0) + 1);
    return byDrawing;
  }, [inspectionId]);

  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<Drawing | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<Drawing | null>(null);

  async function addFiles(files: File[]) {
    onActivity?.({ busy: true, failed: false });
    const failed: string[] = [];
    for (const [i, file] of files.entries()) {
      setStatus(`Adding ${file.name} (${i + 1} of ${files.length})…`);
      try {
        await storePdf(
          inspectionId,
          drawingNameFromFile(file.name),
          new Uint8Array(await file.arrayBuffer()),
        );
      } catch (e) {
        console.error("Could not add drawing", e);
        failed.push(`${file.name} couldn't be opened as a PDF.`);
      }
    }
    setStatus(null);
    setErrors(failed);
    onActivity?.({ busy: false, failed: failed.length > 0 });
  }

  async function addSynthetic() {
    setStatus("Generating synthetic test drawing…");
    setErrors([]);
    try {
      const { buildSyntheticDrawing, TYPICAL_DRAWING } =
        await import("./fixtures/syntheticDrawing");
      await storePdf(
        inspectionId,
        "Synthetic test drawing",
        await buildSyntheticDrawing(TYPICAL_DRAWING),
      );
    } catch (e) {
      setErrors([`Couldn't create the test drawing: ${String(e)}`]);
    } finally {
      setStatus(null);
    }
  }

  const busy = status !== null;
  const deletingCount = deleting ? (counts?.get(deleting.id) ?? 0) : 0;

  return (
    <div className="drawings-section" aria-labelledby="drawings-heading">
      <div className="page-heading">
        <h2 id="drawings-heading" className="section-title">
          <Files aria-hidden="true" /> Drawings
        </h2>
        <span className="button-row">
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <FilePlus aria-hidden="true" /> Add drawings
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addSynthetic()}
          >
            Add synthetic test drawing
          </button>
        </span>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        data-testid="drawing-file-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void addFiles(files);
        }}
      />
      {status && (
        <p role="status" data-testid="drawings-status">
          {status}
        </p>
      )}
      {errors.map((message) => (
        <p key={message} role="alert" className="error">
          {message}
        </p>
      ))}

      {drawings && drawings.length === 0 && !busy && (
        <p className="muted">
          No drawings yet. Add the drawing PDFs for this inspection; they stay
          on this device.
        </p>
      )}
      {drawings && drawings.length > 0 && (
        <ul className="inspection-list" aria-label="Drawings">
          {drawings.map((drawing) => {
            const count = counts?.get(drawing.id) ?? 0;
            return (
              <li key={drawing.id} className="inspection-card">
                <button
                  type="button"
                  className="inspection-card-link link-like"
                  onClick={() => onOpen?.(drawing.id)}
                >
                  <span className="inspection-card-title">{drawing.name}</span>
                  <span>
                    {drawing.pageCount}{" "}
                    {drawing.pageCount === 1 ? "page" : "pages"} · {count}{" "}
                    {count === 1 ? "item" : "items"}
                    {drawing.fileSize
                      ? ` · ${formatBytes(drawing.fileSize)}`
                      : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Rename ${drawing.name}`}
                  title="Rename"
                  onClick={() => {
                    setNewName(drawing.name);
                    setRenaming(drawing);
                  }}
                >
                  <Pencil aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button danger-outline"
                  aria-label={`Delete ${drawing.name}`}
                  title="Delete"
                  onClick={() => setDeleting(drawing)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={renaming !== null}
        title="Rename drawing"
        confirmLabel="Save"
        wide
        onCancel={() => setRenaming(null)}
        onConfirm={() => {
          if (renaming) void renameDrawing(db, renaming.id, newName);
          setRenaming(null);
        }}
      >
        <label className="field">
          <span>Name</span>
          <input
            name="drawingName"
            value={newName}
            autoCapitalize="words"
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete drawing?"
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void deleteDrawing(db, deleting.id);
          setDeleting(null);
        }}
      >
        <p>
          <strong>{deleting?.name}</strong>
          {deletingCount > 0
            ? ` and its ${deletingCount} ${deletingCount === 1 ? "item" : "items"} will be removed from this device.`
            : " will be removed from this device."}
        </p>
        <p>
          This can't be undone. Remaining items are re-lettered so there are no
          gaps.
        </p>
      </ConfirmDialog>
    </div>
  );
}
