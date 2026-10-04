/**
 * Where a screen's back button goes: the screen it was opened from (e.g.
 * an inspection opened from its project goes back to the project), else
 * the Inspections list. Kept for the browser session only; it's navigation, not
 * user data.
 */
const KEY = "back-targets";

function read(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

/** Remembers that `key` (e.g. "inspection:<id>") was opened from `path`. */
export function rememberBack(key: string, path: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...read(), [key]: path }));
  } catch {
    // Storage unavailable (e.g. private browsing): back goes home.
  }
}

export interface BackTarget {
  path: string;
  /** Accessible name, e.g. "Back to project". */
  label: string;
}

export function backTarget(key: string): BackTarget {
  const path = read()[key] ?? "/inspections";
  if (path.startsWith("/projects/")) return { path, label: "Back to project" };
  if (path.startsWith("/inspections/"))
    return { path, label: "Back to inspection" };
  if (path === "/") return { path, label: "Back to dashboard" };
  return { path: "/inspections", label: "Back to inspections" };
}
