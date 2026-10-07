import { describe, expect, test } from "vitest";
import {
  DEFAULT_PREFS,
  MAX_SLOTS,
  addSlot,
  parsePrefs,
  recolourSlot,
  removeSlot,
  selectSlot,
  toolColour,
} from "./markupPrefs";

const fresh = () => structuredClone(DEFAULT_PREFS);

describe("markup colour slots", () => {
  test("colours saved before slots reset to the defaults; weights stay", () => {
    const old = JSON.stringify({
      palettes: { pen: ["#DA1A32", "#123456", "#123457", "#123458"] },
      colour: { pen: "#123458" },
      weight: { pen: 0.004 },
      fingerDraw: true,
    });
    const prefs = parsePrefs(old);
    expect(prefs.palettes).toEqual(DEFAULT_PREFS.palettes);
    expect(prefs.selected).toEqual({
      pen: 0,
      highlighter: 0,
      shapes: 0,
      text: 0,
    });
    expect(prefs.weight.pen).toBe(0.004);
    expect(prefs.fingerDraw).toBe(true);
  });

  test("slots round-trip; a bad selection falls back to the first", () => {
    const p = fresh();
    selectSlot(p, "pen", 2);
    expect(parsePrefs(JSON.stringify(p))).toEqual(p);
    expect(
      parsePrefs(JSON.stringify({ ...p, selected: { pen: 99 } })).selected.pen,
    ).toBe(0);
    expect(parsePrefs("not json")).toEqual(DEFAULT_PREFS);
  });

  test("recolouring changes only the slot in use, never adds one", () => {
    const p = fresh();
    selectSlot(p, "pen", 1);
    for (const c of ["#100000", "#200000", "#300000"])
      recolourSlot(p, "pen", c);
    expect(p.palettes.pen).toHaveLength(DEFAULT_PREFS.palettes.pen.length);
    expect(toolColour(p, "pen")).toBe("#300000");
    expect(p.palettes.pen[0]).toBe(DEFAULT_PREFS.palettes.pen[0]);
  });

  test("Add colour goes at the end and is selected; the old slot keeps its colour", () => {
    const p = fresh();
    selectSlot(p, "pen", 1);
    addSlot(p, "pen");
    const n = DEFAULT_PREFS.palettes.pen.length;
    expect(p.selected.pen).toBe(n);
    recolourSlot(p, "pen", "#ABCDEF");
    expect(p.palettes.pen[n]).toBe("#ABCDEF");
    expect(p.palettes.pen[1]).toBe(DEFAULT_PREFS.palettes.pen[1]);
    while (p.palettes.pen.length < MAX_SLOTS) addSlot(p, "pen");
    addSlot(p, "pen");
    expect(p.palettes.pen).toHaveLength(MAX_SLOTS);
  });

  test("Remove takes the slot in use; one always stays", () => {
    const p = fresh();
    // The last slot: its neighbour takes over.
    selectSlot(p, "highlighter", 3);
    removeSlot(p, "highlighter");
    expect(p.palettes.highlighter).toEqual(["#FFFF00", "#39FF14", "#FF2DB4"]);
    expect(p.selected.highlighter).toBe(2);
    removeSlot(p, "highlighter");
    removeSlot(p, "highlighter");
    removeSlot(p, "highlighter");
    expect(p.palettes.highlighter).toEqual(["#FFFF00"]);
  });

  test("pastel highlighter slots start again from the fluoro set; pen slots stay", () => {
    const old = JSON.stringify({
      palettes: {
        pen: ["#DA1A32", "#123456"],
        highlighter: ["#FFD400", "#7CE38B", "#FF9EC4"],
      },
      selected: { pen: 1, highlighter: 2, shapes: 0, text: 0 },
    });
    const prefs = parsePrefs(old);
    expect(prefs.palettes.pen).toEqual(["#DA1A32", "#123456"]);
    expect(prefs.selected.pen).toBe(1);
    expect(prefs.palettes.highlighter).toEqual(
      DEFAULT_PREFS.palettes.highlighter,
    );
    expect(prefs.selected.highlighter).toBe(0);
    // Once fluoro, they're kept.
    expect(parsePrefs(JSON.stringify(prefs))).toEqual(prefs);
  });
});
