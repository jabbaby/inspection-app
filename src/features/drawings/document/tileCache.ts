/**
 * Sharp renders of parts of pages ("tiles"), kept after they're drawn so
 * zooming back into a place already seen shows it at once (SPEC section 12).
 * One cache for the whole document, limited by pixels: iPad Safari caps
 * total canvas memory, and past it new canvases silently fail. The least
 * recently used tile goes first; a tile on screen is never dropped.
 */
import type { Rect } from "../viewer/viewTransform";

/** What the cache needs of a canvas (tests use plain objects). */
export interface TileCanvas {
  width: number;
  height: number;
}

export interface Tile<C extends TileCanvas = HTMLCanvasElement> {
  pageKey: string;
  canvas: C;
  /** The part of the page it shows (page units). */
  rect: Rect;
  /** Device pixels per page unit it was drawn at. */
  scale: number;
  shown: boolean;
  used: number;
}

function covers(outer: Rect, inner: Rect) {
  const e = 0.5; // page units: rounding at the edges
  return (
    outer.x <= inner.x + e &&
    outer.y <= inner.y + e &&
    outer.x + outer.width >= inner.x + inner.width - e &&
    outer.y + outer.height >= inner.y + inner.height - e
  );
}

export class TileCache<C extends TileCanvas = HTMLCanvasElement> {
  private tiles: Tile<C>[] = [];
  private clock = 0;
  private readonly budget: number;
  private readonly release: (canvas: C) => void;

  constructor(budget: number, release: (canvas: C) => void) {
    this.budget = budget;
    this.release = release;
  }

  /**
   * A kept tile of this page covering `part` at `minScale` or sharper (the
   * least sharp that will do, so less is scaled down), marked as used.
   */
  find(pageKey: string, part: Rect, minScale: number): Tile<C> | undefined {
    const fit = this.tiles
      .filter(
        (t) =>
          t.pageKey === pageKey && t.scale >= minScale && covers(t.rect, part),
      )
      .sort((a, b) => a.scale - b.scale)[0];
    if (fit) fit.used = ++this.clock;
    return fit;
  }

  /** Keeps a new tile, dropping the least recently used ones over budget. */
  add(tile: Omit<Tile<C>, "used" | "shown">): Tile<C> {
    const kept: Tile<C> = { ...tile, shown: false, used: ++this.clock };
    this.tiles.push(kept);
    this.trim();
    return kept;
  }

  setShown(tile: Tile<C>, shown: boolean) {
    tile.shown = shown;
    if (!shown) this.trim();
  }

  /** Drops every tile of a page (it went off screen). */
  dropPage(pageKey: string) {
    for (const t of this.tiles.filter((t) => t.pageKey === pageKey))
      this.release(t.canvas);
    this.tiles = this.tiles.filter((t) => t.pageKey !== pageKey);
  }

  /** Pixels held. */
  get pixels() {
    return this.tiles.reduce((n, t) => n + t.canvas.width * t.canvas.height, 0);
  }

  get size() {
    return this.tiles.length;
  }

  private trim() {
    const spare = this.tiles
      .filter((t) => !t.shown)
      .sort((a, b) => a.used - b.used);
    while (this.pixels > this.budget && spare.length) {
      const oldest = spare.shift()!;
      this.release(oldest.canvas);
      this.tiles = this.tiles.filter((t) => t !== oldest);
    }
  }
}
