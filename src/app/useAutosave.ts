import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

const RETRY_MS = 3000;

/**
 * Saves edits shortly after typing stops, merging changes made in between.
 * Pending changes are flushed when a field loses focus, when the app is
 * hidden or closed, and when the component unmounts, so nothing typed is
 * lost. Failed saves are kept and retried.
 */
export function useAutosave<P>(
  save: (patch: P) => Promise<void>,
  merge: (earlier: P, later: P) => P,
  delay = 400,
) {
  const [state, setState] = useState<SaveState>("idle");
  const pending = useRef<P | null>(null);
  const timer = useRef(0);
  const saveRef = useRef(save);
  const mergeRef = useRef(merge);
  const mounted = useRef(true);
  // Lets the retry timer call the latest flush without a self-reference.
  const retry = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    saveRef.current = save;
    mergeRef.current = merge;
  });

  const setIfMounted = (next: SaveState) => {
    if (mounted.current) setState(next);
  };

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    if (patch === null) return;
    pending.current = null;
    setIfMounted("saving");
    try {
      await saveRef.current(patch);
      setIfMounted(pending.current === null ? "saved" : "saving");
    } catch (error) {
      console.error("Autosave failed", error);
      pending.current =
        pending.current === null
          ? patch
          : mergeRef.current(patch, pending.current);
      setIfMounted("error");
      timer.current = window.setTimeout(() => retry.current(), RETRY_MS);
    }
  }, []);

  useLayoutEffect(() => {
    retry.current = () => void flush();
  }, [flush]);

  const queue = useCallback(
    (patch: P) => {
      pending.current =
        pending.current === null
          ? patch
          : mergeRef.current(pending.current, patch);
      setState("saving");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  /** Drops unsaved changes (e.g. when the record is being deleted). */
  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    pending.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      mounted.current = false;
      void flush();
    };
  }, [flush]);

  return { queue, flush, cancel, state };
}

export function saveStateLabel(state: SaveState): string {
  switch (state) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Couldn't save, retrying…";
    default:
      return "";
  }
}
