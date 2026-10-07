/**
 * The markup toolbar's choices, kept on the device (small UI preferences
 * in localStorage, as CLAUDE.md allows): each tool's colour slots and
 * which one is in use, its weight, and Draw with finger. Never part of an
 * inspection.
 *
 * Colours work as in GoodNotes: each tool has a row of slots. Tapping a
 * slot uses it; the slot in use can be recoloured (which never adds one),
 * and Add colour puts a new slot at the end of the row.
 */
import { useSyncExternalStore } from "react";
import { northrop } from "../../brand/northrop";
import type { MarkupShape, MarkupTool } from "../../db/types";
import { SHAPES } from "../../db/types";
import { WEIGHT_PRESETS } from "./markGeometry";

/** Slots per tool: they all fit in the toolbar. */
export const MAX_SLOTS = 10;

/** Which row of colour slots a tool uses: shapes share the pen's. */
export type PaletteKey = "pen" | "highlighter";

export function paletteOf(tool: MarkupTool): PaletteKey {
  return tool === "highlighter" ? "highlighter" : "pen";
}

export interface MarkupPrefs {
  /** Colour slots: pen (shapes and text share it), and highlighter. */
  palettes: Record<PaletteKey, string[]>;
  /** Each tool's slot in use (an index into its palette). */
  selected: Record<MarkupTool, number>;
  weight: Record<MarkupTool, number>;
  /** The shape the Shapes tool draws (the last one picked). */
  shape: MarkupShape;
  fingerDraw: boolean;
  /** Draw the stroke on to the iPad's predicted Pencil points (Settings). */
  predict: boolean;
  /**
   * Which highlighter colour set the slots came from: 2 is fluoro
   * (2026-10-07). Older (pastel) slots start again from the fluoro defaults.
   */
  highlighterSet: number;
}

const KEY = "markup-prefs";

export const DEFAULT_PREFS: MarkupPrefs = {
  palettes: {
    pen: [
      northrop.colours.red,
      northrop.markup.blue,
      "#111111",
      "#1E9E4A",
      "#FF8A00",
      "#8A4FFF",
    ],
    // Fluoro (engineer, 2026-10-07): yellow, green, pink, red.
    highlighter: ["#FFFF00", "#39FF14", "#FF2DB4", "#FF1744"],
  },
  selected: { pen: 0, highlighter: 0, shapes: 0, text: 0 },
  weight: {
    pen: WEIGHT_PRESETS.pen[1],
    highlighter: WEIGHT_PRESETS.highlighter[1],
    shapes: WEIGHT_PRESETS.shapes[1],
    text: WEIGHT_PRESETS.text[1],
  },
  shape: "cloud",
  fingerDraw: false,
  predict: false,
  highlighterSet: 2,
};

/** The colours the Pen colour (or Highlighter colour) panel offers. */
export const PRESET_COLOURS: Record<PaletteKey, string[]> = {
  pen: [
    northrop.colours.red,
    "#FF8A00",
    "#FFD400",
    "#1E9E4A",
    "#00A3A3",
    northrop.markup.blue,
    "#8A4FFF",
    "#E64C9A",
    "#7A4B2A",
    "#111111",
    "#6B6B6B",
    "#B0B0B0",
  ],
  // Fluoro, so highlights read as highlighter on the drawing (engineer,
  // 2026-10-07: the pastel set's "red" came out brown).
  highlighter: [
    "#FFFF00",
    "#FFC400",
    "#FF7A00",
    "#FF1744",
    "#FF2DB4",
    "#E100FF",
    "#9D4BFF",
    "#2979FF",
    "#00C3FF",
    "#00E5C0",
    "#39FF14",
    "#C6FF00",
  ],
};

const isColour = (c: unknown): c is string =>
  typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);

/** Anything stored that doesn't look right falls back to the default. */
export function parsePrefs(raw: string | null): MarkupPrefs {
  let stored: Partial<MarkupPrefs> = {};
  try {
    stored = (raw ? JSON.parse(raw) : {}) as typeof stored;
  } catch {
    // Unreadable: defaults.
  }
  const prefs = structuredClone(DEFAULT_PREFS);
  // Colours saved before slots (no "selected") start again from the
  // defaults: the old palette added a colour for every move of the picker.
  const slotted = typeof stored.selected === "object" && stored.selected;
  // Highlighter slots from before the fluoro set start again too.
  const fluoro = stored.highlighterSet === DEFAULT_PREFS.highlighterSet;
  for (const key of ["pen", "highlighter"] as const) {
    const palette = stored.palettes?.[key];
    if (
      slotted &&
      (key === "pen" || fluoro) &&
      Array.isArray(palette) &&
      palette.length &&
      palette.every(isColour)
    )
      prefs.palettes[key] = palette.slice(0, MAX_SLOTS);
  }
  for (const tool of ["pen", "highlighter", "shapes", "text"] as const) {
    const slots = prefs.palettes[paletteOf(tool)];
    const selected =
      slotted && (tool !== "highlighter" || fluoro)
        ? stored.selected?.[tool]
        : undefined;
    if (
      typeof selected === "number" &&
      Number.isInteger(selected) &&
      selected >= 0 &&
      selected < slots.length
    )
      prefs.selected[tool] = selected;
    const weight = stored.weight?.[tool];
    if (typeof weight === "number" && weight > 0 && weight < 0.1)
      prefs.weight[tool] = weight;
  }
  if (typeof stored.fingerDraw === "boolean")
    prefs.fingerDraw = stored.fingerDraw;
  if (typeof stored.predict === "boolean") prefs.predict = stored.predict;
  if (stored.shape && SHAPES.includes(stored.shape)) prefs.shape = stored.shape;
  return prefs;
}

/** The colour a tool draws in: its slot in use. */
export function toolColour(prefs: MarkupPrefs, tool: MarkupTool): string {
  const slots = prefs.palettes[paletteOf(tool)];
  return slots[prefs.selected[tool]] ?? slots[0];
}

// --- slot changes (pure, on a copy of the prefs) -------------------------

export function selectSlot(p: MarkupPrefs, tool: MarkupTool, i: number) {
  if (i >= 0 && i < p.palettes[paletteOf(tool)].length) p.selected[tool] = i;
}

/** Recolours the slot in use (the colour picker calls this as it moves). */
export function recolourSlot(p: MarkupPrefs, tool: MarkupTool, colour: string) {
  if (isColour(colour))
    p.palettes[paletteOf(tool)][p.selected[tool]] = colour.toUpperCase();
}

/**
 * A new slot at the end of the row, in the current colour, and in use: the
 * slot it came from keeps its colour. Nothing happens once the row is full.
 */
export function addSlot(p: MarkupPrefs, tool: MarkupTool) {
  const slots = p.palettes[paletteOf(tool)];
  if (slots.length >= MAX_SLOTS) return;
  slots.push(toolColour(p, tool));
  p.selected[tool] = slots.length - 1;
}

/** Removes the slot in use (a tool keeps at least one); its neighbour takes over. */
export function removeSlot(p: MarkupPrefs, tool: MarkupTool) {
  const key = paletteOf(tool);
  const slots = p.palettes[key];
  if (slots.length <= 1) return;
  const removed = p.selected[tool];
  slots.splice(removed, 1);
  // Tools sharing this row keep pointing at the same colour where they can.
  for (const other of ["pen", "highlighter", "shapes", "text"] as const) {
    if (paletteOf(other) !== key) continue;
    if (other !== tool && p.selected[other] > removed) p.selected[other] -= 1;
    p.selected[other] = Math.min(p.selected[other], slots.length - 1);
  }
}

// --- the stored prefs -----------------------------------------------------

let current: MarkupPrefs | null = null;
const listeners = new Set<() => void>();

function read(): MarkupPrefs {
  if (!current) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      // Storage blocked: defaults for this session.
    }
    current = parsePrefs(raw);
  }
  return current;
}

export function updatePrefs(change: (prefs: MarkupPrefs) => void): void {
  const next = structuredClone(read());
  change(next);
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Kept for this session only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMarkupPrefs(): MarkupPrefs {
  return useSyncExternalStore(subscribe, read);
}
