import { describe, expect, test } from "vitest";
import {
  ROLL,
  chooseAxis,
  isRolling,
  lockToAxis,
  releaseVelocity,
  rollStep,
  type Sample,
} from "./momentum";

describe("axis lock", () => {
  test("a mostly vertical drag locks up/down", () => {
    expect(chooseAxis(3, 20)).toBe("y");
    expect(chooseAxis(-3, -20)).toBe("y");
  });

  test("a mostly sideways drag locks across", () => {
    expect(chooseAxis(25, 4)).toBe("x");
  });

  test("a diagonal drag moves freely", () => {
    expect(chooseAxis(10, 12)).toBe("free");
  });

  test("locking removes the other direction", () => {
    expect(lockToAxis("y", { x: 5, y: 9 })).toEqual({ x: 0, y: 9 });
    expect(lockToAxis("x", { x: 5, y: 9 })).toEqual({ x: 5, y: 0 });
    expect(lockToAxis("free", { x: 5, y: 9 })).toEqual({ x: 5, y: 9 });
  });
});

describe("release speed", () => {
  const drag = (speed: number, end: number): Sample[] =>
    Array.from({ length: 6 }, (_, i) => ({
      t: end - 80 + i * 16,
      x: 0,
      y: (end - 80 + i * 16) * speed,
    }));

  test("measures the recent speed", () => {
    const v = releaseVelocity(drag(-2, 1000), 1000);
    expect(v.x).toBe(0);
    expect(v.y).toBeCloseTo(-2);
  });

  test("ignores old samples", () => {
    const samples: Sample[] = [
      { t: 0, x: 0, y: 0 },
      ...drag(1, 1000).map((s) => ({ ...s, y: s.y + 5000 })),
    ];
    expect(releaseVelocity(samples, 1000).y).toBeCloseTo(1);
  });

  test("a finger held still before lifting doesn't roll", () => {
    expect(releaseVelocity(drag(2, 1000), 1000 + ROLL.holdMs + 20)).toEqual({
      x: 0,
      y: 0,
    });
  });

  test("a slow drag doesn't roll", () => {
    expect(releaseVelocity(drag(0.05, 1000), 1000)).toEqual({ x: 0, y: 0 });
  });

  test("a very fast flick is capped", () => {
    const v = releaseVelocity(drag(30, 1000), 1000);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(ROLL.maxSpeed);
  });
});

describe("roll", () => {
  test("slows down and stops", () => {
    let v = { x: 0, y: 2 };
    let travelled = 0;
    let frames = 0;
    while (isRolling(v) && frames < 1000) {
      const step = rollStep(v, 16);
      travelled += step.move.y;
      v = step.v;
      frames++;
    }
    expect(frames).toBeLessThan(1000);
    // 2 px/ms with iOS deceleration rolls about 1000 px.
    expect(travelled).toBeGreaterThan(900);
    expect(travelled).toBeLessThan(1000);
  });

  test("covers the same distance at any frame rate", () => {
    const run = (dt: number) => {
      let v = { x: 0, y: 3 };
      let y = 0;
      for (let t = 0; t < 480; t += dt) {
        const step = rollStep(v, dt);
        y += step.move.y;
        v = step.v;
      }
      return y;
    };
    expect(run(8)).toBeCloseTo(run(16), 6);
  });
});
