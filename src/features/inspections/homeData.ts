import { missingJobFields } from "../../db/inspections";
import type { Inspection, Item, JobInspection, Memo } from "../../db/types";
import type { InspectionTab } from "./tabPath";

/** How far an inspection has got, for its status and the home screen. */
export interface InspectionProgress {
  memoReference: string | null;
  itemCount: number;
  instructions: number;
  observations: number;
  drawings: number;
  photos: number;
}

export function emptyProgress(): InspectionProgress {
  return {
    memoReference: null,
    itemCount: 0,
    instructions: 0,
    observations: 0,
    drawings: 0,
    photos: 0,
  };
}

/** Progress for each inspection, from its memo, items and drawings. */
export function progressByInspection(
  inspections: Pick<Inspection, "id" | "photoIds">[],
  memos: Pick<Memo, "inspectionId" | "reference">[],
  items: Pick<Item, "inspectionId" | "kind" | "photoIds">[],
  drawings: { inspectionId: string }[],
): Map<string, InspectionProgress> {
  const progress = new Map<string, InspectionProgress>();
  for (const i of inspections)
    progress.set(i.id, { ...emptyProgress(), photos: i.photoIds.length });
  for (const m of memos) {
    const p = progress.get(m.inspectionId);
    if (p) p.memoReference = m.reference;
  }
  for (const item of items) {
    const p = progress.get(item.inspectionId);
    if (!p) continue;
    p.itemCount++;
    if (item.kind === "instruction") p.instructions++;
    else p.observations++;
    p.photos += item.photoIds.length;
  }
  for (const d of drawings) {
    const p = progress.get(d.inspectionId);
    if (p) p.drawings++;
  }
  return progress;
}

/** The three steps' done flags: details, inspection, memo. */
export function stepsDone(
  inspection: JobInspection,
  progress: InspectionProgress,
): [boolean, boolean, boolean] {
  return [
    !!inspection.projectId && missingJobFields(inspection).length === 0,
    progress.itemCount > 0,
    !!progress.memoReference,
  ];
}

export interface NextStep {
  tab: InspectionTab;
  label: string;
}

/** The obvious next thing to do on an inspection. */
export function nextStep(
  inspection: JobInspection,
  progress: InspectionProgress,
): NextStep {
  if (!inspection.projectId)
    return { tab: "details", label: "Assign a project" };
  if (progress.memoReference) return { tab: "memo", label: "Open memo" };
  if (progress.itemCount > 0) return { tab: "memo", label: "Create memo" };
  if (progress.drawings > 0)
    return { tab: "inspection", label: "Open drawings" };
  return { tab: "inspection", label: "Add drawings" };
}

export interface Attention {
  inspection: JobInspection;
  tone: "danger" | "todo";
  reason: string;
  tab: InspectionTab;
}

/** Inspections that need something: a project, or a memo for their items. */
export function needsAttention(
  inspections: JobInspection[],
  progress: Map<string, InspectionProgress>,
  limit = 4,
): Attention[] {
  const found: Attention[] = [];
  for (const inspection of inspections) {
    const p = progress.get(inspection.id) ?? emptyProgress();
    if (!inspection.projectId)
      found.push({
        inspection,
        tone: "danger",
        reason: "Needs a project",
        tab: "details",
      });
    else if (p.itemCount > 0 && !p.memoReference)
      found.push({
        inspection,
        tone: "todo",
        reason: `${p.itemCount} item${p.itemCount === 1 ? "" : "s"}, no memo yet`,
        tab: "memo",
      });
  }
  return found.slice(0, limit);
}

/** Splits inspections (newest first) into this week and earlier. */
export function groupByWeek<T extends { updatedAt: number }>(
  inspections: T[],
  now: Date = new Date(),
): { label: string; inspections: T[] }[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  // Weeks start on Monday.
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const thisWeek = inspections.filter((i) => i.updatedAt >= start.getTime());
  const earlier = inspections.filter((i) => i.updatedAt < start.getTime());
  return [
    { label: "This week", inspections: thisWeek },
    { label: "Earlier", inspections: earlier },
  ].filter((group) => group.inspections.length > 0);
}

/** Counts for the current calendar month. */
export function monthStats(
  inspections: Pick<Inspection, "createdAt">[],
  memos: Pick<Memo, "createdAt">[],
  items: Pick<Item, "createdAt">[],
  now: Date = new Date(),
): { inspections: number; memos: number; items: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const count = (list: { createdAt: number }[]) =>
    list.filter((x) => x.createdAt >= start).length;
  return {
    inspections: count(inspections),
    memos: count(memos),
    items: count(items),
  };
}

/** "Good morning, Sam" (or without a name). */
export function greeting(
  inspectorName: string,
  now: Date = new Date(),
): string {
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const first = inspectorName.trim().split(/\s+/)[0];
  return first ? `Good ${part}, ${first}` : `Good ${part}`;
}

/** "just now", "10 min ago", "3 h ago", then the date and time. */
export function editedAgo(timestamp: number, now: number = Date.now()) {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

/** "Saturday 4 October". */
export function longToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(now)
    .replace(",", "");
}

/** Matches an inspection by what was inspected, its job or client. */
export function inspectionMatches(inspection: JobInspection, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    inspection.itemInspected,
    inspection.jobNumber,
    inspection.jobName,
    inspection.client.name,
    inspection.client.company,
  ].some((field) => field.toLowerCase().includes(q));
}
