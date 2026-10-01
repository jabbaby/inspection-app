import type { InspectionDb } from "./schema";
import { ensureSeeded } from "./seed";
import { requestPersistentStorageOnce } from "./storage";

/** First-run setup, safe to call on every launch. */
export async function initDatabase(db: InspectionDb): Promise<void> {
  await ensureSeeded(db);
  await requestPersistentStorageOnce(db);
}
