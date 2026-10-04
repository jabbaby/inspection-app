import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { db } from "../../db/db";
import { drawingNameFromFile, moveDrawing } from "../../db/drawings";
import {
  countUnmarked,
  duplicatePage,
  hideUnmarkedPages,
  movePage,
  pageMoveTarget,
  setPagesHidden,
} from "../../db/pages";
import type { Drawing, Item } from "../../db/types";
import { drawingPages, pageKey } from "./document/documentLayout";
import { usePdfDocuments } from "./document/usePdfDocuments";
import { itemSpots } from "../items/spots";
import { storePdf } from "./drawingFiles";
import { ReorderDrawingsDialog } from "./ReorderDrawingsDialog";
import type { PDFDocumentProxy } from "./pdf/pdfjs";

interface Props {
  open: boolean;
  inspectionId: string;
  drawings: Drawing[];
  items: Item[];
  /** The page the viewer is on (outlined). */
  currentKey: string | null;
  onGoTo: (pageKey: string) => void;
  onClose: () => void;
}

/** One page of the document, as the Pages view lists it. */
interface PageEntry {
  key: string;
  drawing: Drawing;
  /** 1-based position in the drawing's pages. */
  position: number;
  /** 1-based PDF page it shows. */
  source: number;
  hidden: boolean;
  /** Number through the document (visible pages only). */
  number: number;
  pins: number;
}

function entriesFor(drawings: Drawing[], items: Item[]): PageEntry[] {
  const entries: PageEntry[] = [];
  let number = 0;
  for (const drawing of drawings) {
    const pins = new Map<number, number>();
    // Copies of a pin count on their own pages.
    for (const spot of items.flatMap(itemSpots))
      if (spot.drawingId === drawing.id)
        pins.set(spot.page, (pins.get(spot.page) ?? 0) + 1);
    drawingPages(drawing).forEach((page, i) => {
      const hidden = Boolean(page.hidden);
      if (!hidden) number++;
      entries.push({
        key: pageKey(drawing.id, i + 1),
        drawing,
        position: i + 1,
        source: page.source,
        hidden,
        number: hidden ? 0 : number,
        pins: pins.get(i + 1) ?? 0,
      });
    });
  }
  return entries;
}

/**
 * Every page of the inspection's drawings as thumbnails (GoodNotes style):
 * tap one to go to it; each has a menu (go to, duplicate, hide); Select
 * mode hides or duplicates several at once, or hides every page without
 * pins. Hidden pages are listed at the bottom with Restore; the PDFs never
 * change.
 */
export function PagesSheet({
  open,
  inspectionId,
  drawings,
  items,
  currentKey,
  onGoTo,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  // Opens upward when the page is in the lower half of the sheet.
  const [menuUp, setMenuUp] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const entries = useMemo(() => entriesFor(drawings, items), [drawings, items]);
  const visible = entries.filter((e) => !e.hidden);
  const hidden = entries.filter((e) => e.hidden);
  const unmarked = countUnmarked(drawings, items);
  // Each drawing's name sits under its first visible page.
  const firstOfDrawing = new Set(
    drawings
      .map((d) => visible.find((e) => e.drawing.id === d.id)?.key)
      .filter((key): key is string => Boolean(key)),
  );

  // Every drawing's PDF, while the sheet is open.
  const blobIds = useMemo(
    () => new Map(drawings.map((d) => [d.id, d.pdfBlobId])),
    [drawings],
  );
  const { docs } = usePdfDocuments(
    open ? drawings.map((d) => d.id) : [],
    blobIds,
  );

  function close() {
    setSelecting(false);
    setSelected(new Set());
    setMenu(null);
    setStatus(null);
    onClose();
  }

  function toggle(key: string) {
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function hide(chosen: PageEntry[]) {
    const kept = chosen.filter((e) => e.pins > 0).length;
    let count = 0;
    for (const drawing of drawings) {
      const positions = chosen
        .filter((e) => e.drawing.id === drawing.id)
        .map((e) => e.position);
      if (positions.length)
        count += await setPagesHidden(db, drawing.id, positions, true);
    }
    setSelected(new Set());
    setStatus(
      `${count} ${count === 1 ? "page" : "pages"} hidden` +
        (kept ? `; ${kept} with pins kept (remove their items first)` : "") +
        ".",
    );
  }

  async function duplicate(chosen: PageEntry[]) {
    // From the last page back, so earlier positions stay put.
    const ordered = [...chosen].sort(
      (a, b) =>
        drawings.indexOf(b.drawing) - drawings.indexOf(a.drawing) ||
        b.position - a.position,
    );
    for (const entry of ordered)
      await duplicatePage(db, entry.drawing.id, entry.position);
    setSelected(new Set());
    setStatus(
      `${chosen.length} ${chosen.length === 1 ? "page" : "pages"} duplicated.`,
    );
  }

  async function hideUnmarked() {
    const count = await hideUnmarkedPages(db, inspectionId);
    setSelected(new Set());
    setStatus(`${count} unmarked ${count === 1 ? "page" : "pages"} hidden.`);
  }

  async function addFiles(files: File[]) {
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
        setStatus(`${file.name} couldn't be opened as a PDF.`);
        return;
      }
    }
    setStatus(null);
  }

  const chosen = visible.filter((e) => selected.has(e.key));

  /** Moves a page within its drawing; the menu follows it. */
  async function movePageOf(entry: PageEntry, direction: -1 | 1) {
    const to = await movePage(db, entry.drawing.id, entry.position, direction);
    setMenu(pageKey(entry.drawing.id, to));
  }

  return (
    <>
      <dialog
        ref={ref}
        className="pages-sheet"
        aria-label="Pages"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={() => setMenu(null)}
      >
        <div className="pages-sheet-head">
          {selecting ? (
            <button
              type="button"
              className="quiet"
              onClick={() =>
                setSelected(
                  chosen.length === visible.length
                    ? new Set()
                    : new Set(visible.map((e) => e.key)),
                )
              }
            >
              {chosen.length === visible.length ? "Select none" : "Select all"}
            </button>
          ) : (
            <button type="button" className="quiet" onClick={close}>
              Close
            </button>
          )}
          <h2 className="pages-sheet-title">
            {selecting
              ? `${chosen.length} selected`
              : `Pages · ${visible.length}`}
          </h2>
          <button
            type="button"
            className="quiet"
            aria-pressed={selecting}
            onClick={() => {
              setSelecting((on) => !on);
              setSelected(new Set());
              setMenu(null);
            }}
          >
            {selecting ? "Done" : "Select"}
          </button>
        </div>

        <div className="pages-sheet-body">
          {status && (
            <p className="pages-status" role="status">
              {status}
            </p>
          )}
          <ul className="pages-grid" aria-label="Document pages">
            {visible.map((entry) => (
              <li key={entry.key} className="pages-cell">
                <button
                  type="button"
                  className={[
                    "page-thumb",
                    entry.key === currentKey ? "page-thumb-current" : "",
                    selected.has(entry.key) ? "page-thumb-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-testid="page-thumb"
                  aria-label={`Page ${entry.number}: ${entry.drawing.name} page ${entry.source}`}
                  aria-pressed={selecting ? selected.has(entry.key) : undefined}
                  onClick={() => {
                    if (selecting) return toggle(entry.key);
                    close();
                    onGoTo(entry.key);
                  }}
                >
                  <Thumb
                    doc={docs.get(entry.drawing.id)}
                    source={entry.source}
                    active={open}
                  />
                  {entry.pins > 0 && (
                    <span className="page-thumb-pins">
                      {entry.pins} {entry.pins === 1 ? "pin" : "pins"}
                    </span>
                  )}
                  {selecting && (
                    <span
                      className={`page-thumb-check${selected.has(entry.key) ? " on" : ""}`}
                      aria-hidden="true"
                    />
                  )}
                </button>
                <div className="page-thumb-caption">
                  <span>
                    {entry.number}
                    {firstOfDrawing.has(entry.key) && (
                      <span className="page-thumb-drawing">
                        {" "}
                        {entry.drawing.name}
                      </span>
                    )}
                  </span>
                  {!selecting && (
                    <button
                      type="button"
                      className="icon-button quiet page-thumb-menu-button"
                      aria-label={`Page ${entry.number} options`}
                      aria-expanded={menu === entry.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        const at = e.currentTarget.getBoundingClientRect();
                        const sheet = ref.current?.getBoundingClientRect();
                        setMenuUp(
                          sheet ? at.top > sheet.top + sheet.height / 2 : false,
                        );
                        setMenu(menu === entry.key ? null : entry.key);
                      }}
                    >
                      <ChevronDown aria-hidden="true" />
                    </button>
                  )}
                </div>
                {menu === entry.key && (
                  <div
                    className={`page-thumb-menu${menuUp ? " page-thumb-menu-up" : ""}`}
                    role="menu"
                    aria-label={`Page ${entry.number}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        close();
                        onGoTo(entry.key);
                      }}
                    >
                      Go to page
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(null);
                        void duplicate([entry]);
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={entry.pins > 0}
                      onClick={() => {
                        setMenu(null);
                        void hide([entry]);
                      }}
                    >
                      {entry.pins > 0 ? "Hide (has pins)" : "Hide"}
                    </button>
                    <hr className="page-thumb-menu-rule" />
                    <button
                      type="button"
                      role="menuitem"
                      disabled={
                        pageMoveTarget(
                          drawingPages(entry.drawing),
                          entry.position,
                          -1,
                        ) === null
                      }
                      onClick={() => void movePageOf(entry, -1)}
                    >
                      Move page earlier
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={
                        pageMoveTarget(
                          drawingPages(entry.drawing),
                          entry.position,
                          1,
                        ) === null
                      }
                      onClick={() => void movePageOf(entry, 1)}
                    >
                      Move page later
                    </button>
                    {drawings.length > 1 && (
                      <>
                        <hr className="page-thumb-menu-rule" />
                        <button
                          type="button"
                          role="menuitem"
                          disabled={drawings[0].id === entry.drawing.id}
                          onClick={() =>
                            void moveDrawing(db, entry.drawing.id, -1)
                          }
                        >
                          Move drawing earlier
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={drawings.at(-1)!.id === entry.drawing.id}
                          onClick={() =>
                            void moveDrawing(db, entry.drawing.id, 1)
                          }
                        >
                          Move drawing later
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenu(null);
                            setReordering(true);
                          }}
                        >
                          Reorder drawings…
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
            {!selecting && (
              <li className="pages-cell">
                <button
                  type="button"
                  className="page-add"
                  onClick={() => fileInput.current?.click()}
                >
                  <Plus aria-hidden="true" />
                  <span>Add drawings</span>
                </button>
              </li>
            )}
          </ul>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            data-testid="pages-file-input"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (files.length) void addFiles(files);
            }}
          />

          {hidden.length > 0 && (
            <section aria-label="Hidden pages">
              <h3 className="pages-section-title">
                Hidden pages ({hidden.length})
              </h3>
              <ul className="pages-grid" aria-label="Hidden pages">
                {hidden.map((entry) => (
                  <li key={entry.key} className="pages-cell page-hidden">
                    <div className="page-thumb">
                      <Thumb
                        doc={docs.get(entry.drawing.id)}
                        source={entry.source}
                        active={open}
                      />
                    </div>
                    <div className="page-thumb-caption">
                      <span className="page-thumb-drawing">
                        {entry.drawing.name} p{entry.source}
                      </span>
                      <button
                        type="button"
                        className="quiet"
                        aria-label={`Restore ${entry.drawing.name} page ${entry.source}`}
                        onClick={() =>
                          void setPagesHidden(
                            db,
                            entry.drawing.id,
                            [entry.position],
                            false,
                          )
                        }
                      >
                        Restore
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {selecting && (
          <div className="pages-actions">
            <button
              type="button"
              className="emphasis"
              disabled={chosen.length === 0}
              onClick={() => void hide(chosen)}
            >
              Hide {chosen.length || ""}{" "}
              {chosen.length === 1 ? "page" : "pages"}
            </button>
            <button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => void duplicate(chosen)}
            >
              Duplicate
            </button>
            <button
              type="button"
              disabled={unmarked === 0}
              onClick={() => void hideUnmarked()}
            >
              Hide unmarked pages ({unmarked})
            </button>
          </div>
        )}
      </dialog>
      <ReorderDrawingsDialog
        open={open && reordering}
        inspectionId={inspectionId}
        drawings={drawings}
        onClose={() => setReordering(false)}
      />
    </>
  );
}

/** A page drawn small, once it scrolls into view; freed when it leaves. */
function Thumb({
  doc,
  source,
  active,
}: {
  doc: PDFDocumentProxy | undefined;
  source: number;
  active: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || !active) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSeen(entry.isIntersecting),
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    const el = host.current;
    if (!el || !doc || !seen) return;
    let current = true;
    let task: { cancel: () => void } | null = null;
    const canvas = document.createElement("canvas");
    void doc.getPage(source).then((page) => {
      if (!current) return;
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (el.clientWidth * dpr) / base.width;
      const viewport = page.getViewport({ scale });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const render = page.render({ canvas, viewport });
      task = render;
      render.promise.then(
        () => {
          if (current) el.replaceChildren(canvas);
        },
        () => undefined,
      );
    });
    return () => {
      current = false;
      task?.cancel();
      canvas.width = 0;
      canvas.height = 0;
      el.replaceChildren();
    };
  }, [doc, source, seen]);

  return <div ref={host} className="page-thumb-image" />;
}
