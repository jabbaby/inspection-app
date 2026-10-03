import { beforeEach, describe, expect, it } from "vitest";
import { backTarget, rememberBack } from "./backTarget";

/** A minimal sessionStorage for the Node test environment. */
function stubStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    },
  });
}

describe("backTarget", () => {
  beforeEach(stubStorage);

  it("goes to Inspections when nothing was remembered", () => {
    expect(backTarget("inspection:a")).toEqual({
      path: "/",
      label: "Back to inspections",
    });
  });

  it("goes back to the project an inspection was opened from", () => {
    rememberBack("inspection:a", "/projects/p1");
    expect(backTarget("inspection:a")).toEqual({
      path: "/projects/p1",
      label: "Back to project",
    });
    // Opening it from Inspections later goes back there instead.
    rememberBack("inspection:a", "/");
    expect(backTarget("inspection:a").path).toBe("/");
  });

  it("goes back to the inspection a project was opened from", () => {
    rememberBack("project:p1", "/inspections/a/details");
    expect(backTarget("project:p1")).toEqual({
      path: "/inspections/a/details",
      label: "Back to inspection",
    });
  });

  it("goes home when storage isn't available", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    rememberBack("inspection:a", "/projects/p1");
    expect(backTarget("inspection:a").path).toBe("/");
  });
});
