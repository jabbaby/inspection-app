import { useState } from "react";
import { saveStateLabel, useAutosave } from "../../app/useAutosave";
import { db } from "../../db/db";
import { updateItem, type ItemPatch } from "../../db/items";
import type { Item, ItemKind } from "../../db/types";
import { deleteItemWithUndo } from "./itemActions";
import { itemLabel, kindName } from "./letters";

interface Props {
  item: Item;
  /** Focus the text box straight away (a pin was just placed). */
  autoFocus?: boolean;
  onClose: () => void;
  /** Label for the close button, e.g. "‹ Items" when opened from the list. */
  closeLabel?: string;
}

const KINDS: { kind: ItemKind; label: string }[] = [
  { kind: "instruction", label: "Instruction" },
  { kind: "observation", label: "Observation" },
];

/**
 * Edits one item: kind, text (saved as you type) and, for instructions, the
 * photo confirmation flag. Render with key={item.id} so text state resets.
 */
export function ItemSheet({
  item,
  autoFocus,
  onClose,
  closeLabel = "Done",
}: Props) {
  const [text, setText] = useState(item.text);
  // Shown straight away; the saved value catches up.
  const [photoFlag, setPhotoFlag] = useState(item.requiresPhotoConfirmation);
  const autosave = useAutosave<ItemPatch>(
    (patch) => updateItem(db, item.id, patch),
    (a, b) => ({ ...a, ...b }),
  );

  const isInstruction = item.kind === "instruction";

  return (
    <aside
      className="item-sheet"
      aria-label={itemLabel(item)}
      data-testid="item-sheet"
    >
      <div className="item-sheet-head">
        <span
          className={`item-badge${isInstruction ? "" : " item-badge-observation"}`}
          aria-hidden="true"
        >
          {item.letter}
        </span>
        <h2>{itemLabel(item)}</h2>
        <span
          className="save-state"
          role="status"
          data-testid="item-save-state"
        >
          {saveStateLabel(autosave.state)}
        </span>
        <button type="button" onClick={onClose}>
          {closeLabel}
        </button>
      </div>

      <div className="segmented" role="group" aria-label="Item kind">
        {KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={item.kind === kind}
            onClick={() => {
              if (item.kind !== kind)
                void autosave
                  .flush()
                  .then(() => updateItem(db, item.id, { kind }));
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>{isInstruction ? "Instruction" : "Observation"}</span>
        <textarea
          name="text"
          rows={4}
          value={text}
          // Focus follows placing a pin so the engineer can type at once.
          autoFocus={autoFocus}
          autoCapitalize="sentences"
          placeholder={
            isInstruction
              ? "e.g. Add N12 bar at grid C/4"
              : "e.g. Existing crack noted at grid 4"
          }
          onChange={(e) => {
            setText(e.target.value);
            autosave.queue({ text: e.target.value });
          }}
          onBlur={() => void autosave.flush()}
        />
      </label>

      {isInstruction && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={photoFlag}
            onChange={(e) => {
              setPhotoFlag(e.target.checked);
              void updateItem(db, item.id, {
                requiresPhotoConfirmation: e.target.checked,
              });
            }}
          />
          Photo confirmation required before proceeding
        </label>
      )}

      <p className="muted item-sheet-note">
        {isInstruction
          ? "Instructions go in this page's notes box and the memo's conditions."
          : "Observations go in this page's notes box, not the memo."}
      </p>

      <button
        type="button"
        className="primary"
        onClick={() => void autosave.flush().then(onClose)}
      >
        Done
      </button>

      {/* No confirm: Undo in the toolbar puts it back. */}
      <button
        type="button"
        className="danger-outline"
        onClick={() => {
          // Save any pending text first so Undo restores it too.
          void autosave
            .flush()
            .then(() => deleteItemWithUndo(item))
            .then(onClose);
        }}
      >
        Delete {kindName(item.kind).toLowerCase()} {item.letter}
      </button>
    </aside>
  );
}
