/**
 * Undo history, one per inspection, kept until the app closes (SPEC section
 * 5). Each entry knows how to reverse one action; the data itself is always
 * saved in IndexedDB, so losing the history never loses work. Actions that
 * should be undoable push an entry; the Undo button runs the latest one.
 */
import { useSyncExternalStore } from "react";

export interface UndoEntry {
  /** What Undo will reverse, e.g. "Delete instruction B". */
  label: string;
  undo: () => Promise<void>;
}

const LIMIT = 50;
const histories = new Map<string, UndoEntry[]>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version++;
  for (const listener of listeners) listener();
}

export function pushUndo(scope: string, entry: UndoEntry): void {
  const history = histories.get(scope) ?? [];
  histories.set(scope, [...history, entry].slice(-LIMIT));
  changed();
}

/** The action Undo would reverse next, if any. */
export function peekUndo(scope: string): UndoEntry | undefined {
  return histories.get(scope)?.at(-1);
}

/** Reverses the latest action. Resolves once it's done (or if none). */
export async function undoLast(scope: string): Promise<void> {
  const history = histories.get(scope);
  const entry = history?.pop();
  if (!entry) return;
  changed();
  await entry.undo();
}

/** Clears every history (tests). */
export function clearUndo(): void {
  histories.clear();
  changed();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The next undoable action for a scope; re-renders when it changes. */
export function useUndo(scope: string): UndoEntry | undefined {
  useSyncExternalStore(subscribe, () => version);
  return peekUndo(scope);
}
