import { describe, expect, test } from "vitest";
import {
  TEXT_SIZES,
  calloutMetrics,
  calloutPlace,
  calloutPoints,
  calloutSize,
  layoutCallout,
  wrapText,
} from "./calloutGeometry";

const A3 = { width: 1191, height: 842 };
// Every character as wide as half the font size.
const measure = (text: string, size: number) => text.length * size * 0.5;

describe("text callouts", () => {
  test("M matches the notes box text (1.2% of the short side)", () => {
    expect(calloutMetrics(TEXT_SIZES[1], A3).fontSize).toBeCloseTo(842 * 0.012);
  });

  test("text is capitals and wraps at word breaks", () => {
    expect(wrapText("lap 600 min", 10, 1000, measure)).toEqual(["LAP 600 MIN"]);
    expect(wrapText("check column starter bars", 10, 50, measure)).toEqual([
      "CHECK",
      "COLUMN",
      "STARTER",
      "BARS",
    ]);
    // A new line typed stays a new line.
    expect(wrapText("one\ntwo", 10, 1000, measure)).toEqual(["ONE", "TWO"]);
  });

  test("the box grows to the text, then wraps at its widest", () => {
    const m = calloutMetrics(TEXT_SIZES[1], A3);
    const short = calloutSize("lap", m, measure);
    const long = calloutSize("x ".repeat(200), m, measure);
    expect(short.width).toBeLessThan(long.width);
    expect(long.width).toBeLessThanOrEqual(m.maxWidth + 0.01);
    expect(long.height).toBeGreaterThan(short.height);
  });

  test("box and tip survive storing", () => {
    const place = {
      box: { x: 100, y: 200, width: 150, height: 40 },
      tip: { x: 60, y: 120 },
    };
    const back = calloutPlace({ points: calloutPoints(place, A3) }, A3);
    expect(back.box.x).toBeCloseTo(100, 1);
    expect(back.box.width).toBeCloseTo(150, 1);
    expect(back.tip!.y).toBeCloseTo(120, 1);
    expect(
      calloutPlace({ points: calloutPoints({ ...place, tip: null }, A3) }, A3)
        .tip,
    ).toBeNull();
  });

  /** A callout's layout with its box at (300, 300) 100 x 40 and `tip`. */
  function withTip(tip: { x: number; y: number }) {
    const points = calloutPoints(
      { box: { x: 300, y: 300, width: 100, height: 40 }, tip },
      A3,
    );
    return layoutCallout(
      { points, weight: TEXT_SIZES[1], text: "lap 600" },
      A3,
      measure,
    );
  }

  test("a leader to the side dog-legs out of the middle of that side", () => {
    const layout = withTip({ x: 100, y: 200 });
    const leader = layout.leader!;
    const shoulder = layout.metrics.fontSize * 1.5;
    // As thick as the box's border.
    expect(leader.width).toBe(layout.metrics.border);
    // Out of the left side's middle, a horizontal shoulder, then the tip.
    expect(leader.points).toHaveLength(3);
    expect(leader.points[0].x).toBeCloseTo(300, 1);
    expect(leader.points[0].y).toBeCloseTo(320, 1);
    expect(leader.points[1].x).toBeCloseTo(300 - shoulder, 1);
    expect(leader.points[1].y).toBeCloseTo(320, 1);
    expect(leader.head[0].x).toBeCloseTo(100, 1);
    expect(leader.head[0].y).toBeCloseTo(200, 1);
    expect(layout.lines.map((l) => l.text)).toEqual(["LAP 600"]);
    // To the right: out of the right side.
    const right = withTip({ x: 600, y: 500 }).leader!;
    expect(right.points[0].x).toBeCloseTo(400, 1);
    expect(right.points[1].x).toBeCloseTo(400 + shoulder, 1);
  });

  test("a leader above or below the box is straight from the nearest edge", () => {
    const leader = withTip({ x: 350, y: 500 }).leader!;
    expect(leader.points).toHaveLength(2);
    expect(leader.points[0].x).toBeCloseTo(350, 1);
    expect(leader.points[0].y).toBeCloseTo(340, 1);
    expect(leader.head[0].y).toBeCloseTo(500, 1);
  });

  test("a resized box keeps its width; its height follows the text", () => {
    const m = calloutMetrics(TEXT_SIZES[1], A3);
    const narrow = calloutSize("check column starter bars", m, measure, 80);
    const wide = calloutSize("check column starter bars", m, measure, 400);
    expect(wide.width).toBe(400);
    expect(narrow.height).toBeGreaterThan(wide.height);
    // Never narrower than its longest word.
    const tiny = calloutSize("starter", m, measure, 1);
    expect(tiny.width).toBeCloseTo(
      measure("STARTER", m.fontSize) + 2 * m.inset,
      5,
    );
  });
});
