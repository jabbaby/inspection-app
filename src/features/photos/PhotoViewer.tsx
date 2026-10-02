import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

/** Space between photos in the strip (px). */
const GAP = 16;
/** Dragged this share of the width, the photo changes on release... */
const DISTANCE = 0.25;
/** ...or flicked at least this fast (px per ms), like the Photos app. */
const FLICK_SPEED = 0.4;
const SLIDE_MS = 240;

interface Drag {
  pointerId: number;
  x: number;
  y: number;
  width: number;
  dx: number;
  frame: number;
  samples: { t: number; x: number }[];
}

/**
 * One photo full screen: swipe (or arrow keys) between photos, an optional
 * caption, Save and Delete. The photos either side are loaded and sit next
 * to the current one in a strip; a drag moves the strip directly (no
 * re-rendering), and on release it glides to the next photo or back.
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
  const area = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const photo = photos[index];
  /** Saves the caption being typed (set by Caption). */
  const saveCaption = useRef<() => Promise<void>>(async () => {});
  const drag = useRef<Drag | null>(null);
  const sliding = useRef(false);
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function moveTrack(px: number, animate: boolean) {
    const el = track.current;
    if (!el) return;
    el.style.transition = animate
      ? `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
      : "none";
    el.style.transform = `translate3d(${px}px, 0, 0)`;
  }

  // Once the photo changes, re-centre the strip on it before it's painted.
  useLayoutEffect(() => {
    moveTrack(0, false);
    sliding.current = false;
  }, [index, photos.length]);

  function go(to: number) {
    if (to < 0 || to >= photos.length) return;
    void saveCaption.current();
    onIndex(to);
  }

  /** Glides to the next (+1) or previous (-1) photo, then shows it. */
  function slideTo(dir: 1 | -1, width: number) {
    const el = track.current;
    if (!el) return go(index + dir);
    sliding.current = true;
    moveTrack(-dir * (width + GAP), true);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener("transitionend", finish);
      go(index + dir);
    };
    el.addEventListener("transitionend", finish);
    // In case the transition end never arrives.
    window.setTimeout(finish, SLIDE_MS + 80);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (sliding.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      width: area.current?.clientWidth ?? 1,
      dx: 0,
      frame: 0,
      samples: [{ t: e.timeStamp, x: e.clientX }],
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const move = e.clientX - d.x;
    // Resist at the first and last photo.
    const blocked = (move > 0 && !hasPrev) || (move < 0 && !hasNext);
    d.dx = blocked ? move / 4 : move;
    d.samples = [...d.samples, { t: e.timeStamp, x: e.clientX }].filter(
      (s) => e.timeStamp - s.t <= 100,
    );
    // At most one update per frame, straight to the strip.
    if (!d.frame)
      d.frame = requestAnimationFrame(() => {
        d.frame = 0;
        moveTrack(d.dx, false);
      });
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    cancelAnimationFrame(d.frame);
    const move = e.clientX - d.x;
    const first = d.samples[0];
    const speed =
      e.timeStamp > first.t
        ? (e.clientX - first.x) / (e.timeStamp - first.t)
        : 0;
    const sideways = Math.abs(move) > Math.abs(e.clientY - d.y);
    const far = Math.abs(move) >= d.width * DISTANCE;
    const flick = Math.abs(speed) >= FLICK_SPEED && Math.abs(move) > 10;
    if (e.type === "pointerup" && sideways && (far || flick)) {
      if (move < 0 && hasNext) return slideTo(1, d.width);
      if (move > 0 && hasPrev) return slideTo(-1, d.width);
    }
    moveTrack(0, true);
  }

  if (!photo) return null;
  // The current photo and its neighbours, keyed by photo so a neighbour's
  // image is already loaded when it slides in.
  const slides = [-1, 0, 1]
    .map((offset) => ({ offset, photo: photos[index + offset] }))
    .filter((s): s is { offset: number; photo: Photo } => !!s.photo);
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
        ref={area}
        className="photo-viewer-image"
        data-testid="photo-viewer-swipe"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={track} className="photo-track">
          {slides.map(({ offset, photo: p }) => (
            <Slide
              key={p.id}
              photo={p}
              offset={offset}
              alt={p.caption || `${title} photo ${index + 1 + offset}`}
            />
          ))}
        </div>
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

/** One photo in the strip, `offset` places either side of the current one. */
function Slide({
  photo,
  offset,
  alt,
}: {
  photo: Photo;
  offset: number;
  alt: string;
}) {
  const url = useBlobUrl(photo.blobId);
  return (
    <div
      className="photo-slide"
      style={{
        transform: `translateX(calc(${offset * 100}% + ${offset * GAP}px))`,
      }}
      aria-hidden={offset !== 0}
    >
      {url && (
        <img
          src={url}
          alt={offset === 0 ? alt : ""}
          data-testid={offset === 0 ? "photo-viewer-image" : undefined}
          draggable={false}
        />
      )}
    </div>
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
