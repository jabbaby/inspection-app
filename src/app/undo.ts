/**
 * Undo and redo history, one per inspection, kept until the app closes
 * (SPEC section 12). Each entry knows how to reverse and re-apply one
 * action; the data itself is always saved in IndexedDB, so losing the
 * history never loses work. Actions that should be undoable push an entry;
 * doing something new clears what could be redone.
 */
import { useSyncExternalStore } from "react";

export interface UndoEntry {
  /** The action, e.g. "Delete instruction B". */
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const LIMIT = 50;
const undoStacks = new Map<string, UndoEntry[]>();
const redoStacks = new Map<string, UndoEntry[]>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version++;
  for (const listener of listeners) listener();
}

function stack(stacks: Map<string, UndoEntry[]>, scope: string) {
  let list = stacks.get(scope);
  if (!list) stacks.set(scope, (list = []));
  return list;
}

export function pushUndo(scope: string, entry: UndoEntry): void {
  const list = stack(undoStacks, scope);
  list.push(entry);
  if (list.length > LIMIT) list.shift();
  redoStacks.delete(scope);
  changed();
}

/** The action Undo would reverse next, if any. */
export function peekUndo(scope: string): UndoEntry | undefined {
  return undoStacks.get(scope)?.at(-1);
}

/** The action Redo would re-apply next, if any. */
export function peekRedo(scope: string): UndoEntry | undefined {
  return redoStacks.get(scope)?.at(-1);
}

/** Reverses the latest action. Resolves once it's done (or if none). */
export async function undoLast(scope: string): Promise<void> {
  const entry = undoStacks.get(scope)?.pop();
  if (!entry) return;
  stack(redoStacks, scope).push(entry);
  changed();
  await entry.undo();
}

/** Re-applies the latest undone action. */
export async function redoLast(scope: string): Promise<void> {
  const entry = redoStacks.get(scope)?.pop();
  if (!entry) return;
  stack(undoStacks, scope).push(entry);
  changed();
  await entry.redo();
}

/** Clears every history (tests). */
export function clearUndo(): void {
  undoStacks.clear();
  redoStacks.clear();
  changed();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** What Undo and Redo would do next for a scope; re-renders on change. */
export function useUndo(scope: string): {
  undo: UndoEntry | undefined;
  redo: UndoEntry | undefined;
} {
  useSyncExternalStore(subscribe, () => version);
  return { undo: peekUndo(scope), redo: peekRedo(scope) };
}
