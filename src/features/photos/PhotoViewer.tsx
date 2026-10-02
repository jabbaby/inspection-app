import { useEffect, useRef, useState } from "react";
import { saveStateLabel, useAutosave } from "../../app/useAutosave";
import { db } from "../../db/db";
import { setPhotoCaption } from "../../db/photos";
import type { Photo } from "../../db/types";
import { useBlobUrl } from "./useBlobUrl";

interface Props {
  photos: Photo[];
  index: number;
  inspectionId: string;
  /** e.g. "Instruction A". */
  title: string;
  onIndex: (index: number) => void;
  onDelete: (photo: Photo) => void;
  onClose: () => void;
}

/** One photo full screen: previous/next, an optional caption, Delete. */
export function PhotoViewer({
  photos,
  index,
  inspectionId,
  title,
  onIndex,
  onDelete,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const photo = photos[index];
  const url = useBlobUrl(photo?.blobId);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  if (!photo) return null;
  return (
    <dialog
      ref={ref}
      className="photo-viewer"
      aria-label={`${title} photo ${index + 1} of ${photos.length}`}
      data-testid="photo-viewer"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="photo-viewer-head">
        <strong>
          {title} · photo {index + 1} of {photos.length}
        </strong>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="photo-viewer-image">
        {url && (
          <img
            src={url}
            alt={photo.caption || `${title} photo ${index + 1}`}
            data-testid="photo-viewer-image"
          />
        )}
      </div>
      <div className="photo-viewer-foot">
        <button
          type="button"
          aria-label="Previous photo"
          disabled={index === 0}
          onClick={() => onIndex(index - 1)}
        >
          ‹
        </button>
        <Caption key={photo.id} photo={photo} inspectionId={inspectionId} />
        <button
          type="button"
          aria-label="Next photo"
          disabled={index === photos.length - 1}
          onClick={() => onIndex(index + 1)}
        >
          ›
        </button>
      </div>
      <p className="button-row">
        <button
          type="button"
          className="danger-outline"
          onClick={() => onDelete(photo)}
        >
          Delete photo
        </button>
      </p>
    </dialog>
  );
}

/** Optional caption, saved as you type. */
function Caption({
  photo,
  inspectionId,
}: {
  photo: Photo;
  inspectionId: string;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const autosave = useAutosave<string>(
    (text) => setPhotoCaption(db, photo.id, text, inspectionId),
    (_, later) => later,
  );
  return (
    <label className="field photo-caption">
      <span>
        Caption (optional){" "}
        <span className="muted">{saveStateLabel(autosave.state)}</span>
      </span>
      <input
        type="text"
        value={caption}
        autoCapitalize="sentences"
        onChange={(e) => {
          setCaption(e.target.value);
          autosave.queue(e.target.value);
        }}
        onBlur={() => void autosave.flush()}
      />
    </label>
  );
}
