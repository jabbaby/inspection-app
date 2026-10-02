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

/** A sideways drag this far (px) moves to the next or previous photo. */
const SWIPE = 60;

/**
 * One photo full screen: swipe (or arrow keys) between photos, an optional
 * caption, Save and Delete.
 */
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
  /** Saves the caption being typed (set by Caption). */
  const saveCaption = useRef<() => Promise<void>>(async () => {});
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function go(to: number) {
    if (to < 0 || to >= photos.length) return;
    void saveCaption.current();
    onIndex(to);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const move = e.clientX - d.x;
    // Resist at the first and last photo.
    const blocked = (move > 0 && !hasPrev) || (move < 0 && !hasNext);
    setDx(blocked ? move / 4 : move);
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    const move = e.clientX - d.x;
    const sideways = Math.abs(move) > Math.abs(e.clientY - d.y);
    setDx(0);
    if (e.type !== "pointerup" || !sideways) return;
    if (move <= -SWIPE) go(index + 1);
    else if (move >= SWIPE) go(index - 1);
  }

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
      onKeyDown={(e) => {
        if ((e.target as Element).tagName === "INPUT") return;
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div className="photo-viewer-head">
        <button type="button" onClick={onClose}>
          Close
        </button>
        <strong>
          {title} · photo {index + 1} of {photos.length}
        </strong>
        <button
          type="button"
          className="primary"
          onClick={() => void saveCaption.current().then(onClose)}
        >
          Save
        </button>
      </div>
      <div
        className="photo-viewer-image"
        data-testid="photo-viewer-swipe"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {url && (
          <img
            src={url}
            alt={photo.caption || `${title} photo ${index + 1}`}
            data-testid="photo-viewer-image"
            draggable={false}
            style={{
              transform: `translateX(${dx}px)`,
              transition: dx === 0 ? "transform 150ms ease" : "none",
            }}
          />
        )}
      </div>
      {photos.length > 1 && (
        <p className="photo-viewer-hint muted">Swipe to see other photos.</p>
      )}
      <Caption
        key={photo.id}
        photo={photo}
        inspectionId={inspectionId}
        saveRef={saveCaption}
      />
      <p className="button-row photo-viewer-actions">
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

/** Optional caption, saved as you type, on Save and when moving on. */
function Caption({
  photo,
  inspectionId,
  saveRef,
}: {
  photo: Photo;
  inspectionId: string;
  saveRef: React.RefObject<() => Promise<void>>;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  // Show a caption saved after the viewer opened, unless typed over (as in
  // the item sheet).
  const [synced, setSynced] = useState(photo.caption ?? "");
  if ((photo.caption ?? "") !== synced) {
    setSynced(photo.caption ?? "");
    if (caption === synced) setCaption(photo.caption ?? "");
  }
  const autosave = useAutosave<string>(
    (text) => setPhotoCaption(db, photo.id, text, inspectionId),
    (_, later) => later,
  );
  useEffect(() => {
    saveRef.current = autosave.flush;
  }, [saveRef, autosave.flush]);
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
