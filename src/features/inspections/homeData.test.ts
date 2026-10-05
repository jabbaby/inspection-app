import { describe, expect, it } from "vitest";
import type { JobInspection } from "../../db/types";
import {
  editedAgo,
  emptyProgress,
  greeting,
  groupByWeek,
  inspectionMatches,
  monthStats,
  needsAttention,
  nextStep,
  progressByInspection,
  stepsDone,
} from "./homeData";

function job(over: Partial<JobInspection> = {}): JobInspection {
  return {
    id: "i1",
    projectId: "p1",
    itemInspected: "Level 3 slab reinforcement",
    date: "2026-10-04",
    inspector: "Test Engineer",
    status: "draft",
    photoIds: [],
    createdAt: 0,
    updatedAt: 0,
    jobNumber: "SY000001",
    jobName: "Example Apartments",
    client: {
      name: "Alex Example",
      company: "Example Builders",
      address1: "",
      address2: "",
    },
    ...over,
  } as JobInspection;
}

describe("progressByInspection", () => {
  it("counts items by kind, drawings, photos and the memo", () => {
    const p = progressByInspection(
      [{ id: "i1", photoIds: ["g1"] }],
      [{ inspectionId: "i1", reference: "SIM-001" }],
      [
        { inspectionId: "i1", kind: "instruction", photoIds: ["a", "b"] },
        { inspectionId: "i1", kind: "observation", photoIds: [] },
        { inspectionId: "other", kind: "instruction", photoIds: [] },
      ],
      [{ inspectionId: "i1" }],
    ).get("i1");
    expect(p).toEqual({
      memoReference: "SIM-001",
      itemCount: 2,
      instructions: 1,
      observations: 1,
      drawings: 1,
      photos: 3,
    });
  });
});

describe("next step and steps done", () => {
  it("asks for a project first", () => {
    expect(nextStep(job({ projectId: null }), emptyProgress())).toEqual({
      tab: "details",
      label: "Assign a project",
    });
  });

  it("then drawings, then a memo, then the memo itself", () => {
    const p = emptyProgress();
    expect(nextStep(job(), p).label).toBe("Add drawings");
    expect(nextStep(job(), { ...p, drawings: 1 }).label).toBe("Open drawings");
    expect(nextStep(job(), { ...p, drawings: 1, itemCount: 2 }).label).toBe(
      "Create memo",
    );
    expect(nextStep(job(), { ...p, memoReference: "SIM-001" }).label).toBe(
      "Open memo",
    );
  });

  it("marks details done only with a project, job number and name", () => {
    const p = { ...emptyProgress(), itemCount: 1 };
    expect(stepsDone(job(), p)).toEqual([true, true, false]);
    expect(stepsDone(job({ jobName: " " }), p)[0]).toBe(false);
    expect(stepsDone(job({ projectId: null }), p)[0]).toBe(false);
  });
});

describe("needsAttention", () => {
  it("flags no project, then items without a memo, then a backup, up to the limit", () => {
    const a = job({ id: "a", projectId: null });
    const b = job({ id: "b" });
    const c = job({ id: "c" });
    const d = job({ id: "d", updatedAt: 5, backedUpAt: 4 });
    const e = job({ id: "e", updatedAt: 5, backedUpAt: 5 });
    const done = { ...emptyProgress(), itemCount: 1, memoReference: "SIM-001" };
    const progress = new Map([
      ["a", emptyProgress()],
      ["b", { ...emptyProgress(), itemCount: 3 }],
      ["c", done],
      ["d", done],
      ["e", done],
    ]);
    const found = needsAttention([a, b, c, d, e], progress, Infinity);
    expect(found.map((f) => [f.inspection.id, f.tone, f.reason])).toEqual([
      ["a", "danger", "Needs a project"],
      ["b", "todo", "3 items, no memo yet"],
      ["c", "todo", "Not backed up"],
      ["d", "todo", "Changed since last backup"],
    ]);
    expect(needsAttention([a, b, c], progress, 1)).toHaveLength(1);
  });
});

describe("groupByWeek", () => {
  it("splits at the start of this week (Monday)", () => {
    // Saturday 4 October 2026, 10 am; the week began Monday 28 September.
    const now = new Date(2026, 9, 4, 10);
    const groups = groupByWeek(
      [
        { id: "sat", updatedAt: new Date(2026, 9, 4, 9).getTime() },
        { id: "mon", updatedAt: new Date(2026, 8, 28, 8).getTime() },
        { id: "sun", updatedAt: new Date(2026, 8, 27, 23).getTime() },
      ],
      now,
    );
    expect(
      groups.map((g) => [g.label, g.inspections.map((i) => i.id)]),
    ).toEqual([
      ["This week", ["sat", "mon"]],
      ["Earlier", ["sun"]],
    ]);
  });

  it("leaves out empty groups", () => {
    expect(groupByWeek([], new Date())).toEqual([]);
  });
});

describe("monthStats", () => {
  it("counts what was created this calendar month", () => {
    const now = new Date(2026, 9, 4);
    const sept = new Date(2026, 8, 30).getTime();
    const oct = new Date(2026, 9, 1).getTime();
    expect(
      monthStats(
        [{ createdAt: sept }, { createdAt: oct }],
        [{ createdAt: oct }],
        [{ createdAt: oct }, { createdAt: oct }, { createdAt: sept }],
        now,
      ),
    ).toEqual({ inspections: 1, memos: 1, items: 2 });
  });
});

describe("greeting", () => {
  it("uses the time of day and the inspector's first name", () => {
    expect(greeting("Test Engineer", new Date(2026, 9, 4, 8))).toBe(
      "Good morning, Test",
    );
    expect(greeting("", new Date(2026, 9, 4, 14))).toBe("Good afternoon");
    expect(greeting("  Sam ", new Date(2026, 9, 4, 19))).toBe(
      "Good evening, Sam",
    );
  });
});

describe("editedAgo", () => {
  it("says how long ago, then falls back to the date", () => {
    const now = new Date(2026, 9, 4, 12).getTime();
    expect(editedAgo(now - 20_000, now)).toBe("just now");
    expect(editedAgo(now - 10 * 60_000, now)).toBe("10 min ago");
    expect(editedAgo(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(editedAgo(now - 3 * 86_400_000, now)).toMatch(/1 Oct 2026/);
  });
});

describe("inspectionMatches", () => {
  it("matches item inspected, job and client, ignoring case", () => {
    expect(inspectionMatches(job(), "slab")).toBe(true);
    expect(inspectionMatches(job(), "sy0000")).toBe(true);
    expect(inspectionMatches(job(), "example builders")).toBe(true);
    expect(inspectionMatches(job(), "harbour")).toBe(false);
    expect(inspectionMatches(job(), "  ")).toBe(true);
  });
});
