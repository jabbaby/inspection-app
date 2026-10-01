/**
 * Scroll feel for the document viewer (GoodNotes / iOS style): a drag picks
 * an axis when it starts, and a finger flick keeps the document rolling,
 * slowing down smoothly. Pure maths, unit tested; the viewer feeds it pointer
 * samples and animation-frame times. Speeds are in px per ms.
 */
import type { Point } from "./viewTransform";

/** Which way a drag may move: straight up/down, straight across, or freely. */
export type Axis = "x" | "y" | "free";

export const ROLL = {
  /** A drag locks to an axis when it is this many times longer than across. */
  lockRatio: 2,
  /** Speed kept per ms of roll: iOS's normal scroll deceleration. */
  deceleration: 0.998,
  /** Release speeds below this don't roll. */
  minStartSpeed: 0.1,
  /** The roll ends below this speed. */
  stopSpeed: 0.02,
  maxSpeed: 8,
  /** Only the last part of a drag sets the release speed. */
  sampleWindowMs: 100,
  /** A finger held still this long before lifting doesn't roll. */
  holdMs: 60,
};

/** Axis for a drag from its first movement. */
export function chooseAxis(dx: number, dy: number): Axis {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay > ax * ROLL.lockRatio) return "y";
  if (ax > ay * ROLL.lockRatio) return "x";
  return "free";
}

/** A movement with the locked-out direction removed. */
export function lockToAxis(axis: Axis, d: Point): Point {
  if (axis === "y") return { x: 0, y: d.y };
  if (axis === "x") return { x: d.x, y: 0 };
  return d;
}

export interface Sample extends Point {
  /** ms */
  t: number;
}

/** Drops samples too old to count towards the release speed. */
export function trimSamples(samples: Sample[], now: number): Sample[] {
  return samples.filter((s) => now - s.t <= ROLL.sampleWindowMs);
}

/** Finger speed when it lifts, from the recent samples (zero if held still). */
export function releaseVelocity(samples: Sample[], now: number): Point {
  const recent = trimSamples(samples, now);
  if (recent.length < 2) return { x: 0, y: 0 };
  const first = recent[0];
  const last = recent[recent.length - 1];
  const dt = last.t - first.t;
  if (dt <= 0 || now - last.t > ROLL.holdMs) return { x: 0, y: 0 };
  const v = { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
  const speed = Math.hypot(v.x, v.y);
  if (speed < ROLL.minStartSpeed) return { x: 0, y: 0 };
  const cap = speed > ROLL.maxSpeed ? ROLL.maxSpeed / speed : 1;
  return { x: v.x * cap, y: v.y * cap };
}

/**
 * One animation frame of roll: how far to move in `dt` ms and the speed
 * after it. Speed decays as deceleration^t, integrated exactly so the roll
 * is the same at any frame rate.
 */
export function rollStep(v: Point, dt: number): { move: Point; v: Point } {
  const k = ROLL.deceleration;
  const keep = Math.pow(k, dt);
  const factor = (keep - 1) / Math.log(k);
  return {
    move: { x: v.x * factor, y: v.y * factor },
    v: { x: v.x * keep, y: v.y * keep },
  };
}

export function isRolling(v: Point): boolean {
  return Math.hypot(v.x, v.y) >= ROLL.stopSpeed;
}
