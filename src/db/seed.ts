import starterSnippets from "../content/snippets.json";
import type { InspectionDb } from "./schema";
import { SETTINGS_ID, type Settings, type Snippet } from "./types";

const defaultSettings: Settings = {
  id: SETTINGS_ID,
  inspectorName: "",
  inspectorTitle: "",
  defaultSentVia: "Email",
  snippetsSeeded: false,
};

/**
 * First-run setup: creates the settings record and seeds the starter
 * snippets exactly once. Snippets the engineer has edited or deleted are
 * never touched again.
 */
export async function ensureSeeded(db: InspectionDb): Promise<void> {
  await db.transaction("rw", db.settings, db.snippets, async () => {
    const settings = (await db.settings.get(SETTINGS_ID)) ?? defaultSettings;
    if (settings.snippetsSeeded) return;

    await db.snippets.bulkPut(starterSnippets as Snippet[]);
    await db.settings.put({ ...settings, snippetsSeeded: true });
  });
}
