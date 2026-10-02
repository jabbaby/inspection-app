import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { ConfirmDialog } from "../../app/ConfirmDialog";
import { db } from "../../db/db";
import {
  addPhotos,
  deletePhoto,
  listInspectionPhotos,
  removeOriginals,
} from "../../db/photos";
import { PhotoSet } from "./PhotoSet";
import { SavePhotosDialog } from "./SavePhotosDialog";

function megabytes(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
}

/**
 * Inspection home: general photos (not tied to a pin; the appendix's
 * General group), then every photo in the inspection: save them all to the
 * iPad (camera shots at full size), then free the space the full-size
 * copies take.
 */
export function PhotosSection({
  inspectionId,
  jobNumber,
}: {
  inspectionId: string;
  jobNumber: string;
}) {
  const entries = useLiveQuery(
    () => listInspectionPhotos(db, inspectionId),
    [inspectionId],
  );
  const generalIds = useLiveQuery(
    async () => (await db.inspections.get(inspectionId))?.photoIds ?? [],
    [inspectionId],
  );
  const [saving, setSaving] = useState(false);
  const [confirmFree, setConfirmFree] = useState(false);
  const [freed, setFreed] = useState<string | null>(null);
  if (!entries || !generalIds) return null;

  const originals = entries.filter((e) => e.photo.originalBlobId);
  const originalBytes = originals.reduce(
    (sum, e) => sum + (e.photo.originalSize ?? 0),
    0,
  );
  const freeable = originals.filter((e) => e.photo.savedAt);
  const freeableBytes = freeable.reduce(
    (sum, e) => sum + (e.photo.originalSize ?? 0),
    0,
  );

  return (
    <div className="later-section" aria-labelledby="photos-heading">
      <h2 id="photos-heading">Photos</h2>
      <p className="muted">
        General photos aren&rsquo;t tied to a pin, e.g. overall views. They go
        at the end of the photo appendix. Add photos for an item from its pin.
      </p>
      <PhotoSet
        photoIds={generalIds}
        inspectionId={inspectionId}
        item={null}
        title="General"
        label="General photos"
        onAdd={async (photos) => {
          await addPhotos(db, { inspectionId }, photos);
        }}
        onDelete={(photo) => void deletePhoto(db, { inspectionId }, photo.id)}
        confirmDelete
      />
      {entries.length > 0 && (
        <>
          <p data-testid="photos-summary">
            {entries.length === 1 ? "1 photo" : `${entries.length} photos`}
            {originals.length > 0 &&
              ` · ${originals.length} full-size camera ${originals.length === 1 ? "copy" : "copies"} kept (${megabytes(originalBytes)})`}
          </p>
          <p className="button-row">
            <button
              type="button"
              className="primary"
              onClick={() => setSaving(true)}
            >
              Save photos to iPad
            </button>
            <button
              type="button"
              disabled={freeable.length === 0}
              onClick={() => setConfirmFree(true)}
            >
              Free up space
            </button>
          </p>
          {freed && (
            <p role="status" className="muted">
              {freed}
            </p>
          )}
        </>
      )}
      {saving && (
        <SavePhotosDialog
          entries={entries}
          jobNumber={jobNumber}
          onClose={() => setSaving(false)}
        />
      )}
      <ConfirmDialog
        open={confirmFree}
        title="Free up space?"
        confirmLabel="Free up space"
        onCancel={() => setConfirmFree(false)}
        onConfirm={() => {
          setConfirmFree(false);
          void removeOriginals(
            db,
            freeable.map((e) => e.photo.id),
          ).then((bytes) => setFreed(`Freed ${megabytes(bytes)}.`));
        }}
      >
        <p>
          This removes the full-size copies of {freeable.length} photo
          {freeable.length === 1 ? "" : "s"} already saved to the iPad (
          {megabytes(freeableBytes)}). The smaller copies stay for the report.
          Photos you saved to the iPad are not affected.
        </p>
      </ConfirmDialog>
    </div>
  );
}
