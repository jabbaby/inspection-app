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

  test("the leader runs from the box's nearest edge to the tip", () => {
    const points = calloutPoints(
      {
        box: { x: 300, y: 300, width: 100, height: 40 },
        tip: { x: 100, y: 320 },
      },
      A3,
    );
    const layout = layoutCallout(
      { points, weight: TEXT_SIZES[1], text: "lap 600" },
      A3,
      measure,
    );
    expect(layout.leader!.from.x).toBeCloseTo(300, 1);
    expect(layout.leader!.from.y).toBeCloseTo(320, 1);
    expect(layout.leader!.head[0].x).toBeCloseTo(100, 1);
    expect(layout.leader!.head[0].y).toBeCloseTo(320, 1);
    expect(layout.lines.map((l) => l.text)).toEqual(["LAP 600"]);
  });
});
