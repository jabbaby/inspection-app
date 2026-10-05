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

/** Kinds with exactly one message, which can't be deleted. */
const SINGLE_KINDS: Snippet["kind"][] = ["photoNote"];

/**
 * First-run setup: creates the settings record and seeds the starter
 * snippets exactly once. Snippets the engineer has edited or deleted are
 * never touched again. A single-message kind added in a later version (the
 * photo note) is added once on devices that don't have it yet.
 */
export async function ensureSeeded(db: InspectionDb): Promise<void> {
  await db.transaction("rw", db.settings, db.snippets, async () => {
    const settings = (await db.settings.get(SETTINGS_ID)) ?? defaultSettings;
    if (settings.snippetsSeeded) {
      for (const kind of SINGLE_KINDS) {
        if ((await db.snippets.where("kind").equals(kind).count()) > 0)
          continue;
        await db.snippets.bulkPut(
          (starterSnippets as Snippet[]).filter((s) => s.kind === kind),
        );
      }
      return;
    }

    await db.snippets.bulkPut(starterSnippets as Snippet[]);
    await db.settings.put({ ...settings, snippetsSeeded: true });
  });
}
