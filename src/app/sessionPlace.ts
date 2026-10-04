/**
 * Small "where you were" notes for this browser session (navigation, not
 * user data): e.g. the last place in the Inspections area, or the page a
 * drawing was open at. Missing or blocked storage just means no memory.
 */
export function readPlace(key: string): string | null {
  try {
    return sessionStorage.getItem(`place:${key}`);
  } catch {
    return null;
  }
}

export function writePlace(key: string, value: string) {
  try {
    sessionStorage.setItem(`place:${key}`, value);
  } catch {
    // Storage unavailable: nothing is remembered.
  }
}
