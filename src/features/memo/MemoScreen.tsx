import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { AutoGrowTextarea } from "../../app/AutoGrowTextarea";
import { saveStateLabel, useAutosave } from "../../app/useAutosave";
import { db } from "../../db/db";
import { updateInspection, type InspectionPatch } from "../../db/inspections";
import { getMemo, updateMemo, type MemoPatch } from "../../db/memos";
import type { Inspection, Memo, Recipient, SentVia } from "../../db/types";
import {
  JobDetailsForm,
  type JobDetailsValues,
} from "../inspections/JobDetailsForm";
import {
  mergePatches,
  toPatch,
  toValues,
  withValues,
} from "../inspections/jobDetails";
import {
  buildMemoPdfInput,
  conditionTicked,
  defaultSalutation,
  defaultSiteVisitRequestedBy,
  letterRange,
  memoInstructions,
} from "./buildMemo";
import { MemoPreview } from "./MemoPreview";
import { conditionsLeadIn, confirmationParagraph } from "./memoTemplate";

const MAX_RECIPIENTS = 5;
const SENT_VIA: SentVia[] = ["Aconex", "Email"];

export function MemoScreen() {
  const { id = "" } = useParams();
  return <MemoEditorFor key={id} inspectionId={id} />;
}

type Load =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; inspection: Inspection; memo: Memo };

/**
 * The Site Instruction Memo editor (SPEC section 4): the form, with a live
 * preview of the exported page. Saves as you type. Job details are the
 * inspection's own, so editing them here changes them everywhere.
 */
function MemoEditorFor({ inspectionId }: { inspectionId: string }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  // Loaded once: the form then owns its values, so typing is never overwritten.
  const [job, setJob] = useState<JobDetailsValues | null>(null);
  const [memo, setMemo] = useState<Memo | null>(null);
  const jobSave = useAutosave<InspectionPatch>(
    (patch) => updateInspection(db, inspectionId, patch),
    mergePatches,
  );
  const memoSave = useAutosave<MemoPatch>(
    (patch) => (memo ? updateMemo(db, memo.id, patch) : Promise.resolve()),
    (a, b) => ({ ...a, ...b }),
  );
  const items = useLiveQuery(
    () => db.items.where("inspectionId").equals(inspectionId).toArray(),
    [inspectionId],
  );
  const snippets = useLiveQuery(() => db.snippets.toArray(), []);

  useEffect(() => {
    let current = true;
    void Promise.all([
      db.inspections.get(inspectionId),
      getMemo(db, inspectionId),
    ]).then(([inspection, found]) => {
      if (!current) return;
      if (!inspection || !found) return setLoad({ status: "missing" });
      setLoad({ status: "ready", inspection, memo: found });
      setJob(toValues(inspection));
      setMemo(found);
    });
    return () => {
      current = false;
    };
  }, [inspectionId]);

  if (load.status === "loading") return null;
  if (load.status === "missing" || !job || !memo || !items || !snippets) {
    if (load.status !== "missing") return null;
    return (
      <section>
        <p>
          <Link to={`/inspections/${inspectionId}`}>‹ Inspection</Link>
        </p>
        <h1>No memo yet</h1>
        <p>Create the memo from the inspection.</p>
      </section>
    );
  }

  function patch(p: MemoPatch) {
    setMemo((m) => (m ? { ...m, ...p } : m));
    memoSave.queue(p);
  }

  const inspection = withValues(load.inspection, job);
  const conditionSnippets = snippets.filter((s) => s.kind === "condition");
  const bodySnippets = snippets.filter((s) => s.kind === "body");
  const instructions = memoInstructions(items);
  const letters = letterRange(instructions.map((i) => i.letter));
  const input = buildMemoPdfInput(memo, inspection, items, conditionSnippets);
  const saveState =
    jobSave.state === "error" || memoSave.state === "error"
      ? "error"
      : jobSave.state === "saving" || memoSave.state === "saving"
        ? "saving"
        : memoSave.state === "saved" || jobSave.state === "saved"
          ? "saved"
          : "idle";

  const setRecipient = (i: number, change: Partial<Recipient>) =>
    patch({
      recipients: memo.recipients.map((r, j) =>
        j === i ? { ...r, ...change } : r,
      ),
    });

  return (
    <section className="memo-screen">
      <p>
        <Link to={`/inspections/${inspectionId}`}>‹ Inspection</Link>
      </p>
      <div className="page-heading">
        <h1>Site Instruction Memo</h1>
        <span
          className="save-state"
          role="status"
          data-testid="memo-save-state"
        >
          {saveStateLabel(saveState)}
        </span>
      </div>

      <div className="memo-layout">
        <div className="memo-form">
          <label className="field">
            <span>Reference</span>
            <input
              value={memo.reference}
              autoCapitalize="characters"
              onChange={(e) => patch({ reference: e.target.value })}
              onBlur={() => void memoSave.flush()}
            />
          </label>

          <h2>Job details</h2>
          <p className="muted">
            Shared with the inspection: changing them here changes them there
            too.
          </p>
          <JobDetailsForm
            values={job}
            onChange={(key, value) => {
              setJob((v) => (v ? { ...v, [key]: value } : v));
              jobSave.queue(toPatch(key, value));
            }}
            onBlur={() => void jobSave.flush()}
          />

          <h2>Recipients</h2>
          <table className="memo-recipients" aria-label="Recipients">
            <thead>
              <tr>
                <th>Company</th>
                <th>Attn</th>
                <th>To</th>
                <th>Copy</th>
                <th>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {memo.recipients.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input
                      aria-label={`Recipient ${i + 1} company`}
                      value={r.company}
                      autoCapitalize="words"
                      onChange={(e) =>
                        setRecipient(i, { company: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Recipient ${i + 1} attention`}
                      value={r.attn}
                      autoCapitalize="words"
                      onChange={(e) =>
                        setRecipient(i, { attn: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Recipient ${i + 1} to`}
                      checked={r.to}
                      onChange={(e) =>
                        setRecipient(i, {
                          to: e.target.checked,
                          copy: e.target.checked ? false : r.copy,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Recipient ${i + 1} copy`}
                      checked={r.copy}
                      onChange={(e) =>
                        setRecipient(i, {
                          copy: e.target.checked,
                          to: e.target.checked ? false : r.to,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={`Remove recipient ${i + 1}`}
                      onClick={() =>
                        patch({
                          recipients: memo.recipients.filter((_, j) => j !== i),
                        })
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="button-row">
            <button
              type="button"
              disabled={memo.recipients.length >= MAX_RECIPIENTS}
              onClick={() =>
                patch({
                  recipients: [
                    ...memo.recipients,
                    { company: "", attn: "", to: false, copy: true },
                  ],
                })
              }
            >
              Add recipient
            </button>
          </p>
          {!memo.recipients.some((r) => r.to) && (
            <p className="notice" data-testid="no-to-recipient">
              Mark at least one recipient as To.
            </p>
          )}

          <h2>Visit</h2>
          <DefaultedField
            label="Site visit requested by"
            value={memo.siteVisitRequestedBy}
            fallback={defaultSiteVisitRequestedBy(inspection.client)}
            onChange={(v) => patch({ siteVisitRequestedBy: v })}
            onBlur={() => void memoSave.flush()}
          />
          <DefaultedField
            label="Reason for visit"
            value={memo.reasonForVisit}
            fallback={inspection.itemInspected}
            onChange={(v) => patch({ reasonForVisit: v })}
            onBlur={() => void memoSave.flush()}
          />
          <label className="field">
            <span>Sent via</span>
            <select
              value={memo.sentVia}
              onChange={(e) => patch({ sentVia: e.target.value as SentVia })}
            >
              {SENT_VIA.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>

          <h2>Letter</h2>
          <DefaultedField
            label="Salutation"
            value={memo.salutation}
            fallback={defaultSalutation(memo.recipients)}
            onChange={(v) => patch({ salutation: v })}
            onBlur={() => void memoSave.flush()}
          />
          <p className="memo-fixed" data-testid="memo-paragraph-1">
            {confirmationParagraph(inspection.itemInspected)}
          </p>
          <label className="field">
            <span>Message</span>
            <select
              aria-label="Prefilled message"
              value={memo.bodySnippetId ?? ""}
              onChange={(e) => {
                const chosen = bodySnippets.find(
                  (s) => s.id === e.target.value,
                );
                if (chosen)
                  patch({ bodySnippetId: chosen.id, bodyText: chosen.text });
              }}
            >
              {memo.bodySnippetId === null && <option value="">Choose…</option>}
              {bodySnippets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Message text (for this memo)</span>
            <AutoGrowTextarea
              rows={4}
              value={memo.bodyText}
              autoCapitalize="sentences"
              onChange={(e) => patch({ bodyText: e.target.value })}
              onBlur={() => void memoSave.flush()}
            />
          </label>

          <h2>Conditions</h2>
          <p className="memo-fixed" data-testid="memo-lead-in">
            {conditionsLeadIn(input.conditions.length)}
          </p>
          <fieldset className="memo-conditions">
            <legend>Standard conditions</legend>
            {conditionSnippets.map((s) => (
              <label key={s.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={conditionTicked(memo, s.id, instructions)}
                  onChange={(e) =>
                    patch({
                      conditionChoices: {
                        ...memo.conditionChoices,
                        [s.id]: e.target.checked,
                      },
                    })
                  }
                />
                {s.text.replace(/\[letters\]/g, letters || "[letters]")}
              </label>
            ))}
          </fieldset>
          {instructions.length === 0 ? (
            <p className="muted">
              No instructions yet, so the memo says &ldquo;Ok to proceed.&rdquo;
            </p>
          ) : (
            <ol className="memo-instructions" aria-label="Instructions">
              {instructions.map((item) => {
                const override = memo.itemOverrides[item.id];
                return (
                  <li key={item.id}>
                    <label className="field">
                      <span>
                        {item.letter}.{" "}
                        {override !== undefined && (
                          <span className="muted">
                            (reworded for this memo)
                          </span>
                        )}
                      </span>
                      <AutoGrowTextarea
                        rows={2}
                        aria-label={`Instruction ${item.letter} in the memo`}
                        value={override ?? item.text}
                        onChange={(e) =>
                          patch({
                            itemOverrides: {
                              ...memo.itemOverrides,
                              [item.id]: e.target.value,
                            },
                          })
                        }
                        onBlur={() => void memoSave.flush()}
                      />
                    </label>
                    {override !== undefined && (
                      <button
                        type="button"
                        onClick={() => {
                          const rest = { ...memo.itemOverrides };
                          delete rest[item.id];
                          patch({ itemOverrides: rest });
                        }}
                      >
                        Use item text
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="muted">
            Instructions come from the pins; add or change them on the drawings.
            Rewording one here changes only the memo.
          </p>

          <h2>Sign-off</h2>
          <label className="field">
            <span>Name</span>
            <input
              value={memo.signOffName}
              autoCapitalize="words"
              onChange={(e) => patch({ signOffName: e.target.value })}
              onBlur={() => void memoSave.flush()}
            />
          </label>
          <label className="field">
            <span>Title</span>
            <input
              value={memo.signOffTitle}
              autoCapitalize="words"
              onChange={(e) => patch({ signOffTitle: e.target.value })}
              onBlur={() => void memoSave.flush()}
            />
          </label>
        </div>

        <MemoPreview input={input} />
      </div>
    </section>
  );
}

/**
 * A field with a default worked out from other data (e.g. the salutation
 * from the first To recipient). Shows the default until changed; Reset
 * goes back to it.
 */
function DefaultedField({
  label,
  value,
  fallback,
  onChange,
  onBlur,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (value: string | null) => void;
  onBlur: () => void;
}) {
  return (
    <div className="defaulted-field">
      <label className="field">
        <span>{label}</span>
        <input
          value={value ?? fallback}
          autoCapitalize="sentences"
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      </label>
      {/* Outside the label, so the field's name stays just the label. */}
      {value !== null && value !== fallback && (
        <button
          type="button"
          className="link-button"
          aria-label={`Reset ${label.toLowerCase()}`}
          onClick={() => onChange(null)}
        >
          Reset
        </button>
      )}
    </div>
  );
}
