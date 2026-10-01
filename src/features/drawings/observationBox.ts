/**
 * The observations box drawn on each drawing page that has pins (SPEC
 * section 5). Pure layout and text rules shared by the viewer and, in build
 * step 8, the PDF export, so both draw it the same size in the same place.
 * Sizes are in page units (PDF points) and scale with the sheet.
 */
import { northrop } from "../../brand/northrop";
import type { Item } from "../../db/types";
import { formatDdMmYyyy } from "../../lib/dates";
import { indexForLetter } from "../items/letters";
import type { Point, Size } from "./viewer/viewTransform";

export interface BoxMetrics {
  fontSize: number;
  lineHeight: number;
  padding: number;
  width: number;
  margin: number;
  borderWidth: number;
}

/**
 * Text is 1.2% of the sheet's short side: about 20 pt on A1, 10 pt on A3 and
 * 7 pt on A4. The box is 42 text-heights wide, so the header usually fits on
 * one line.
 */
export function boxMetrics(page: Size): BoxMetrics {
  const short = Math.min(page.width, page.height);
  const fontSize = short * 0.012;
  return {
    fontSize,
    lineHeight: fontSize * 1.3,
    padding: fontSize * 0.6,
    width: Math.min(fontSize * 42, page.width * 0.9),
    margin: short * 0.02,
    borderWidth: Math.max(0.5, fontSize * 0.06),
  };
}

/** Width as a fraction of the page width (positions are stored 0..1). */
export function boxWidthFraction(page: Size): number {
  return boxMetrics(page).width / page.width;
}

/** Default spot: top right, inset by the margin. */
export function defaultBoxPosition(page: Size): Point {
  const m = boxMetrics(page);
  return {
    x: Math.max(0, 1 - (m.margin + m.width) / page.width),
    y: m.margin / page.height,
  };
}

/** Keeps the box's top-left on the page with the whole box width inside. */
export function clampBoxPosition(p: Point, page: Size): Point {
  return {
    x: Math.min(Math.max(0, p.x), Math.max(0, 1 - boxWidthFraction(page))),
    y: Math.min(Math.max(0, p.y), 0.98),
  };
}

/** "Test Engineer" -> "T. Engineer"; a single name is returned as is. */
export function initialAndSurname(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words[0] ?? "";
  return `${words[0][0].toUpperCase()}. ${words[words.length - 1]}`;
}

/**
 * "NORTHROP INSPECTION | Level 3 slab reinforcement | T. Engineer | 01/10/2026".
 * Empty parts are left out.
 */
export function boxHeader(inspection: {
  itemInspected: string;
  inspector: string;
  date: string;
}): string {
  return [
    `${northrop.name.toUpperCase()} INSPECTION`,
    inspection.itemInspected.trim(),
    initialAndSurname(inspection.inspector),
    inspection.date ? formatDdMmYyyy(inspection.date) : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

/** That page's observations in letter order, e.g. "D. Existing crack". */
export function observationLines(items: Item[]): string[] {
  return items
    .filter((item) => item.kind === "observation")
    .sort((a, b) => indexForLetter(a.letter) - indexForLetter(b.letter))
    .map((item) => `${item.letter}. ${item.text.trim()}`.trim());
}
