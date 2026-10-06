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
import type { MarkupTool } from "../../db/types";
import { WEIGHT_PRESETS } from "./markGeometry";

/** Slots per tool: they all fit in the toolbar. */
export const MAX_SLOTS = 10;

export interface MarkupPrefs {
  /** Colour slots: pen (shapes and text later share it), and highlighter. */
  palettes: Record<MarkupTool, string[]>;
  /** The slot in use (an index into the palette). */
  selected: Record<MarkupTool, number>;
  weight: Record<MarkupTool, number>;
  fingerDraw: boolean;
  /** Draw the stroke on to the iPad's predicted Pencil points (Settings). */
  predict: boolean;
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
    highlighter: ["#FFD400", "#7CE38B", "#FF9EC4"],
  },
  selected: { pen: 0, highlighter: 0 },
  weight: {
    pen: WEIGHT_PRESETS.pen[1],
    highlighter: WEIGHT_PRESETS.highlighter[1],
  },
  fingerDraw: false,
  predict: false,
};

/** The colours the Pen colour (or Highlighter colour) panel offers. */
export const PRESET_COLOURS: Record<MarkupTool, string[]> = {
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
  highlighter: [
    "#FFD400",
    "#FFB300",
    "#FF8A65",
    "#FF9EC4",
    "#C9A7FF",
    "#9FC5FF",
    "#5BD3E6",
    "#7CE38B",
    "#C6E86B",
    "#FFE57F",
    "#D7CCC8",
    "#CFD8DC",
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
  for (const tool of ["pen", "highlighter"] as const) {
    const palette = stored.palettes?.[tool];
    if (
      slotted &&
      Array.isArray(palette) &&
      palette.length &&
      palette.every(isColour)
    )
      prefs.palettes[tool] = palette.slice(0, MAX_SLOTS);
    const slots = prefs.palettes[tool];
    const selected = slotted ? stored.selected?.[tool] : undefined;
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
  return prefs;
}

/** The colour a tool draws in: its slot in use. */
export function toolColour(prefs: MarkupPrefs, tool: MarkupTool): string {
  const slots = prefs.palettes[tool];
  return slots[prefs.selected[tool]] ?? slots[0];
}

// --- slot changes (pure, on a copy of the prefs) -------------------------

export function selectSlot(p: MarkupPrefs, tool: MarkupTool, i: number) {
  if (i >= 0 && i < p.palettes[tool].length) p.selected[tool] = i;
}

/** Recolours the slot in use (the colour picker calls this as it moves). */
export function recolourSlot(p: MarkupPrefs, tool: MarkupTool, colour: string) {
  if (isColour(colour))
    p.palettes[tool][p.selected[tool]] = colour.toUpperCase();
}

/**
 * A new slot at the end of the row, in the current colour, and in use: the
 * slot it came from keeps its colour. Nothing happens once the row is full.
 */
export function addSlot(p: MarkupPrefs, tool: MarkupTool) {
  const slots = p.palettes[tool];
  if (slots.length >= MAX_SLOTS) return;
  slots.push(toolColour(p, tool));
  p.selected[tool] = slots.length - 1;
}

/** Removes the slot in use (a tool keeps at least one); its neighbour takes over. */
export function removeSlot(p: MarkupPrefs, tool: MarkupTool) {
  const slots = p.palettes[tool];
  if (slots.length <= 1) return;
  slots.splice(p.selected[tool], 1);
  p.selected[tool] = Math.min(p.selected[tool], slots.length - 1);
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
