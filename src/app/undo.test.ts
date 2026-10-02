import { afterEach, describe, expect, test } from "vitest";
import { clearUndo, peekUndo, pushUndo, undoLast } from "./undo";

afterEach(clearUndo);

describe("undo history", () => {
  test("undoes the latest action first, per inspection", async () => {
    const done: string[] = [];
    const entry = (label: string) => ({
      label,
      undo: async () => {
        done.push(label);
      },
    });
    pushUndo("insp-1", entry("first"));
    pushUndo("insp-1", entry("second"));
    pushUndo("insp-2", entry("other inspection"));

    expect(peekUndo("insp-1")?.label).toBe("second");
    await undoLast("insp-1");
    await undoLast("insp-1");
    await undoLast("insp-1"); // nothing left: no-op
    expect(done).toEqual(["second", "first"]);
    expect(peekUndo("insp-1")).toBeUndefined();
    expect(peekUndo("insp-2")?.label).toBe("other inspection");
  });

  test("keeps the last 50 actions", () => {
    for (let i = 0; i < 60; i++)
      pushUndo("insp", { label: `a${i}`, undo: async () => {} });
    expect(peekUndo("insp")?.label).toBe("a59");
  });
});
