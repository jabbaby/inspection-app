import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { db } from "../../db/db";
import type { Item, Photo } from "../../db/types";
import { itemLabel } from "../items/letters";
import { addPhotosWithUndo, deletePhotoWithUndo } from "./photoActions";
import { PhotoViewer } from "./PhotoViewer";
import { processPhoto } from "./processPhoto";
import { SavePhotosDialog } from "./SavePhotosDialog";
import { useBlobUrl } from "./useBlobUrl";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * An item's photos in its sheet: Take photo (camera, original kept for
 * saving at full size), Choose photos (library, several at once), and
 * thumbnails that open full screen.
 */
export function ItemPhotos({ item }: { item: Item }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const jobNumber =
    useLiveQuery(
      async () => (await db.inspections.get(item.inspectionId))?.jobNumber,
      [item.inspectionId],
    ) ?? "";
  const photos =
    useLiveQuery(
      async () =>
        (await db.photos.bulkGet(item.photoIds)).filter(
          (p): p is Photo => p !== undefined,
        ),
      [item.photoIds.join(",")],
    ) ?? [];

  async function add(files: File[], source: Photo["source"]) {
    setError(null);
    setStatus(`Adding ${plural(files.length, "photo")}…`);
    const processed = [];
    let failed = 0;
    // One at a time: decoding several large photos at once can run an
    // iPad out of memory.
    for (const file of files) {
      try {
        processed.push(await processPhoto(file, source));
      } catch (e) {
        console.error("Photo import failed", e);
        failed++;
      }
    }
    try {
      if (processed.length) await addPhotosWithUndo(item, processed);
    } catch (e) {
      console.error("Saving photos failed", e);
      failed = files.length;
    }
    setStatus(null);
    if (failed)
      setError(
        `${plural(failed, "photo")} couldn't be added. Try again, or choose a different photo.`,
      );
  }

  const onFiles =
    (source: Photo["source"]) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.target.files ?? [])];
      e.target.value = "";
      if (files.length) void add(files, source);
    };

  return (
    <div className="item-photos" role="group" aria-label="Photos">
      <span className="item-photos-label">
        Photos{photos.length ? ` (${photos.length})` : ""}
      </span>
      <div className="item-photos-buttons">
        <button
          type="button"
          disabled={status !== null}
          onClick={() => camera.current?.click()}
        >
          Take photo
        </button>
        <button
          type="button"
          disabled={status !== null}
          onClick={() => library.current?.click()}
        >
          Choose photos
        </button>
        {photos.length > 0 && (
          <button type="button" onClick={() => setSaving(true)}>
            Save to iPad
          </button>
        )}
      </div>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid="photo-camera-input"
        onChange={onFiles("camera")}
      />
      <input
        ref={library}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="photo-library-input"
        onChange={onFiles("library")}
      />
      {status && (
        <p role="status" data-testid="photos-status">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {photos.length > 0 && (
        <ul className="photo-grid" aria-label="Photos of this item">
          {photos.map((photo, i) => (
            <li key={photo.id}>
              <Thumb
                photo={photo}
                label={`${itemLabel(item)} photo ${i + 1}`}
                onOpen={() => setViewing(i)}
              />
            </li>
          ))}
        </ul>
      )}
      {saving && (
        <SavePhotosDialog
          entries={photos.map((photo, i) => ({ item, photo, number: i + 1 }))}
          jobNumber={jobNumber}
          onClose={() => setSaving(false)}
        />
      )}
      {viewing !== null && photos[viewing] && (
        <PhotoViewer
          photos={photos}
          index={viewing}
          inspectionId={item.inspectionId}
          title={itemLabel(item)}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onDelete={(photo) => {
            void deletePhotoWithUndo(item, photo.id);
            setViewing(
              photos.length <= 1 ? null : Math.min(viewing, photos.length - 2),
            );
          }}
        />
      )}
    </div>
  );
}

function Thumb({
  photo,
  label,
  onOpen,
}: {
  photo: Photo;
  label: string;
  onOpen: () => void;
}) {
  const url = useBlobUrl(photo.blobId);
  return (
    <button
      type="button"
      className="photo-thumb"
      aria-label={`Open ${label}`}
      data-testid="photo-thumb"
      onClick={onOpen}
    >
      {url && <img src={url} alt="" />}
    </button>
  );
}
