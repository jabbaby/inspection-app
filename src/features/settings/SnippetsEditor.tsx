import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { ConfirmDialog } from "../../app/ConfirmDialog";
import { saveStateLabel, useAutosave } from "../../app/useAutosave";
import { db } from "../../db/db";
import { addSnippet, deleteSnippet, updateSnippet } from "../../db/snippets";
import type { Snippet, SnippetKind } from "../../db/types";

const GROUPS: { kind: SnippetKind; title: string; hint: string }[] = [
  {
    kind: "body",
    title: "Memo messages",
    hint: "The memo's second paragraph. Pick one per memo, then edit it there if needed.",
  },
  {
    kind: "condition",
    title: "Standard conditions",
    hint: "Ticked per memo; listed before the instructions. [letters] becomes the instruction letters, e.g. A–D.",
  },
  {
    kind: "heading",
    title: "Notes box heading",
    hint: "Heads the observations in each drawing page's notes box.",
  },
];

/**
 * Settings: the prefilled messages (snippets) the memo and notes box use.
 * Each saves as you type; changes reach memos straight away, except a memo
 * message already chosen (the memo keeps its own copy of that text).
 */
export function SnippetsEditor() {
  const snippets = useLiveQuery(() => db.snippets.toArray(), []);
  const [deleting, setDeleting] = useState<Snippet | null>(null);
  if (!snippets) return null;

  return (
    <div className="snippets-editor">
      {GROUPS.map((group) => {
        const list = snippets.filter((s) => s.kind === group.kind);
        return (
          <section
            key={group.kind}
            className="snippet-group"
            aria-label={group.title}
          >
            <h3>{group.title}</h3>
            <p className="muted">{group.hint}</p>
            {list.map((s) => (
              <SnippetRow
                key={s.id}
                snippet={s}
                onDelete={() => setDeleting(s)}
              />
            ))}
            <p className="button-row">
              <button
                type="button"
                onClick={() => void addSnippet(db, group.kind)}
              >
                Add
              </button>
            </p>
          </section>
        );
      })}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.label ?? ""}"?`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void deleteSnippet(db, deleting.id);
          setDeleting(null);
        }}
      >
        <p>
          It won&rsquo;t be offered for new memos. Memos that already use a memo
          message keep their text; a deleted standard condition leaves every
          memo.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function SnippetRow({
  snippet,
  onDelete,
}: {
  snippet: Snippet;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(snippet.label);
  const [text, setText] = useState(snippet.text);
  const autosave = useAutosave<Partial<Pick<Snippet, "label" | "text">>>(
    (patch) => updateSnippet(db, snippet.id, patch),
    (a, b) => ({ ...a, ...b }),
  );
  return (
    <div className="snippet-row" data-testid="snippet-row">
      <label className="field">
        <span>
          Name <span className="muted">{saveStateLabel(autosave.state)}</span>
        </span>
        <input
          value={label}
          aria-label={`Name of ${snippet.label}`}
          onChange={(e) => {
            setLabel(e.target.value);
            autosave.queue({ label: e.target.value });
          }}
          onBlur={() => void autosave.flush()}
        />
      </label>
      <label className="field">
        <span>Text</span>
        <textarea
          rows={snippet.kind === "heading" ? 1 : 3}
          value={text}
          aria-label={`Text of ${snippet.label}`}
          autoCapitalize="sentences"
          onChange={(e) => {
            setText(e.target.value);
            autosave.queue({ text: e.target.value });
          }}
          onBlur={() => void autosave.flush()}
        />
      </label>
      <p className="button-row">
        <button type="button" className="danger-outline" onClick={onDelete}>
          Delete
        </button>
      </p>
    </div>
  );
}
