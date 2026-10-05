/**
 * The markup toolbar's choices, kept on the device (small UI preferences
 * in localStorage, as CLAUDE.md allows): each tool's colour and weight,
 * the saved palettes, and Draw with finger. Never part of an inspection.
 */
import { useSyncExternalStore } from "react";
import { northrop } from "../../brand/northrop";
import type { MarkupTool } from "../../db/types";
import { WEIGHT_PRESETS } from "./markGeometry";

export interface MarkupPrefs {
  /** Saved colours: pen (shapes and text later share it), and highlighter. */
  palettes: Record<MarkupTool, string[]>;
  colour: Record<MarkupTool, string>;
  weight: Record<MarkupTool, number>;
  fingerDraw: boolean;
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
  colour: { pen: northrop.colours.red, highlighter: "#FFD400" },
  weight: {
    pen: WEIGHT_PRESETS.pen[1],
    highlighter: WEIGHT_PRESETS.highlighter[1],
  },
  fingerDraw: false,
};

const isColour = (c: unknown): c is string =>
  typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);

/** Anything stored that doesn't look right falls back to the default. */
export function parsePrefs(raw: string | null): MarkupPrefs {
  let stored: Partial<MarkupPrefs> = {};
  try {
    stored = (raw ? JSON.parse(raw) : {}) as Partial<MarkupPrefs>;
  } catch {
    // Unreadable: defaults.
  }
  const prefs = structuredClone(DEFAULT_PREFS);
  for (const tool of ["pen", "highlighter"] as const) {
    const palette = stored.palettes?.[tool];
    if (Array.isArray(palette) && palette.every(isColour))
      prefs.palettes[tool] = palette;
    const colour = stored.colour?.[tool];
    if (isColour(colour)) prefs.colour[tool] = colour;
    const weight = stored.weight?.[tool];
    if (typeof weight === "number" && weight > 0 && weight < 0.1)
      prefs.weight[tool] = weight;
  }
  if (typeof stored.fingerDraw === "boolean")
    prefs.fingerDraw = stored.fingerDraw;
  return prefs;
}

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

/** Adds a colour to a palette (once) and makes it the tool's colour. */
export function addColour(tool: MarkupTool, colour: string): void {
  updatePrefs((p) => {
    const c = colour.toUpperCase();
    if (!p.palettes[tool].some((x) => x.toUpperCase() === c))
      p.palettes[tool].push(c);
    p.colour[tool] = c;
  });
}

/** Removes a saved colour (the palette always keeps one). */
export function removeColour(tool: MarkupTool, colour: string): void {
  updatePrefs((p) => {
    if (p.palettes[tool].length <= 1) return;
    p.palettes[tool] = p.palettes[tool].filter((c) => c !== colour);
    if (p.colour[tool] === colour) p.colour[tool] = p.palettes[tool][0];
  });
}
