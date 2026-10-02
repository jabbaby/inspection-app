import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "../../db/db";
import {
  formatBytes,
  getStorageStatus,
  type StorageStatus,
} from "../../db/storage";
import type { SnippetKind } from "../../db/types";
import { MyDetailsForm } from "./MyDetailsForm";
import { SnippetsEditor } from "./SnippetsEditor";

const KINDS: SnippetKind[] = ["body", "condition", "heading"];

export function SettingsPage() {
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const snippets = useLiveQuery(() => db.snippets.toArray(), []);

  useEffect(() => {
    void getStorageStatus().then(setStorage);
  }, []);

  return (
    <section>
      <h1>Settings</h1>

      <MyDetailsForm />

      <h2>Storage</h2>
      <dl className="facts">
        <dt>Used</dt>
        <dd data-testid="storage-used">
          {storage === null
            ? "Checking…"
            : storage.usage === undefined || storage.quota === undefined
              ? "Not reported on this device"
              : `${formatBytes(storage.usage)} of ${formatBytes(storage.quota)}`}
        </dd>
        <dt>Persistent</dt>
        <dd data-testid="storage-persistent">
          {storage === null
            ? "Checking…"
            : storage.persisted === undefined
              ? "Not reported on this device"
              : storage.persisted
                ? "Yes"
                : "No (the browser may clear data if space runs low)"}
        </dd>
      </dl>
      <p>
        <button type="button" disabled>
          Back up now
        </button>{" "}
        <small>Available once inspections can be exported.</small>
      </p>

      <h2>Prefilled messages</h2>
      <p data-testid="snippet-count">
        {snippets === undefined
          ? "Loading…"
          : `${snippets.length} snippets (${KINDS.map(
              (kind) =>
                `${snippets.filter((s) => s.kind === kind).length} ${kind}`,
            ).join(", ")})`}
      </p>

      <SnippetsEditor />
    </section>
  );
}
