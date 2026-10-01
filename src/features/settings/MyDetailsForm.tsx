import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { saveStateLabel, useAutosave } from "../../app/useAutosave";
import { db } from "../../db/db";
import { SETTINGS_ID, type SentVia, type Settings } from "../../db/types";

type Details = Pick<
  Settings,
  "inspectorName" | "inspectorTitle" | "defaultSentVia"
>;

const SENT_VIA: SentVia[] = ["Aconex", "Email"];

/** Inspector details: prefill new inspections and (step 7) the memo sign-off. */
export function MyDetailsForm() {
  // Settings are created on first run; show the form once they exist.
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_ID), []);
  return settings ? <MyDetailsFields initial={settings} /> : null;
}

/** Owns the field values after the first load so typing is never overwritten. */
function MyDetailsFields({ initial }: { initial: Details }) {
  const [values, setValues] = useState<Details>({
    inspectorName: initial.inspectorName,
    inspectorTitle: initial.inspectorTitle,
    defaultSentVia: initial.defaultSentVia,
  });
  const autosave = useAutosave<Partial<Details>>(
    async (patch) => {
      await db.settings.update(SETTINGS_ID, patch);
    },
    (a, b) => ({ ...a, ...b }),
  );

  const change = <K extends keyof Details>(key: K, value: Details[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    autosave.queue({ [key]: value });
  };

  return (
    <section aria-labelledby="my-details-heading">
      <div className="page-heading">
        <h2 id="my-details-heading">My details</h2>
        <span
          className="save-state"
          role="status"
          data-testid="settings-save-state"
        >
          {saveStateLabel(autosave.state)}
        </span>
      </div>
      <p className="muted">Used for new inspections and the memo sign-off.</p>
      <form
        className="form-grid"
        aria-label="My details"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="field">
          <span>Inspector name</span>
          <input
            name="inspectorName"
            value={values.inspectorName}
            autoCapitalize="words"
            autoComplete="name"
            onChange={(e) => change("inspectorName", e.target.value)}
            onBlur={() => void autosave.flush()}
          />
        </label>
        <label className="field">
          <span>Title</span>
          <input
            name="inspectorTitle"
            value={values.inspectorTitle}
            autoCapitalize="words"
            autoComplete="organization-title"
            onChange={(e) => change("inspectorTitle", e.target.value)}
            onBlur={() => void autosave.flush()}
          />
        </label>
        <label className="field">
          <span>Default "Sent via"</span>
          <select
            name="defaultSentVia"
            value={values.defaultSentVia}
            onChange={(e) =>
              change("defaultSentVia", e.target.value as SentVia)
            }
            onBlur={() => void autosave.flush()}
          >
            {SENT_VIA.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </form>
    </section>
  );
}
