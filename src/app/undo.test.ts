import { afterEach, describe, expect, test } from "vitest";
import {
  clearUndo,
  peekRedo,
  peekUndo,
  pushUndo,
  redoLast,
  undoLast,
} from "./undo";

afterEach(clearUndo);

const log: string[] = [];
const entry = (label: string) => ({
  label,
  undo: async () => {
    log.push(`undo ${label}`);
  },
  redo: async () => {
    log.push(`redo ${label}`);
  },
});

describe("undo history", () => {
  test("undoes the latest action first, per inspection", async () => {
    log.length = 0;
    pushUndo("insp-1", entry("first"));
    pushUndo("insp-1", entry("second"));
    pushUndo("insp-2", entry("other inspection"));

    expect(peekUndo("insp-1")?.label).toBe("second");
    await undoLast("insp-1");
    await undoLast("insp-1");
    await undoLast("insp-1"); // nothing left: no-op
    expect(log).toEqual(["undo second", "undo first"]);
    expect(peekUndo("insp-1")).toBeUndefined();
    expect(peekUndo("insp-2")?.label).toBe("other inspection");
  });

  test("redoes what was undone, most recent first", async () => {
    log.length = 0;
    pushUndo("insp", entry("a"));
    pushUndo("insp", entry("b"));
    await undoLast("insp");
    await undoLast("insp");
    expect(peekRedo("insp")?.label).toBe("a");
    await redoLast("insp");
    expect(log).toEqual(["undo b", "undo a", "redo a"]);
    expect(peekUndo("insp")?.label).toBe("a");
    expect(peekRedo("insp")?.label).toBe("b");
  });

  test("a new action clears what could be redone", async () => {
    pushUndo("insp", entry("a"));
    await undoLast("insp");
    pushUndo("insp", entry("b"));
    expect(peekRedo("insp")).toBeUndefined();
  });

  test("keeps the last 50 actions", () => {
    for (let i = 0; i < 60; i++) pushUndo("insp", entry(`a${i}`));
    expect(peekUndo("insp")?.label).toBe("a59");
  });
});
