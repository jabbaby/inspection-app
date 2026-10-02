import { useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "../../app/ConfirmDialog";
import { useBlobUrl } from "../photos/useBlobUrl";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import { imageToSignaturePng } from "./signatureImage";

/**
 * Shows a signature and lets the engineer draw one (signing pad) or upload
 * an image (a PNG, or a photo of a signature on paper), or remove it.
 * `onSave` stores the new PNG; `extra` adds buttons (e.g. "Use my saved
 * signature").
 */
export function SignatureField({
  label,
  blobId,
  onSave,
  onRemove,
  extra,
}: {
  label: string;
  blobId: string | null | undefined;
  onSave: (png: Uint8Array) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
  extra?: ReactNode;
}) {
  const url = useBlobUrl(blobId ?? undefined);
  const pad = useRef<SignaturePadHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [padHasInk, setPadHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(png: Uint8Array | null, empty: string) {
    if (!png) return setError(empty);
    setError(null);
    await onSave(png);
  }

  return (
    <div className="signature-field" role="group" aria-label={label}>
      <div className="signature-preview" data-testid="signature-preview">
        {blobId && url ? (
          <img src={url} alt={label} />
        ) : (
          <span className="muted">No signature yet.</span>
        )}
      </div>
      <p className="button-row">
        <button type="button" onClick={() => setDrawing(true)}>
          Draw signature
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? "Reading image…" : "Upload image"}
        </button>
        {extra}
        {blobId && (
          <button
            type="button"
            className="danger-outline"
            onClick={() => void onRemove()}
          >
            Remove
          </button>
        )}
      </p>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        data-testid="signature-file-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            await save(
              await imageToSignaturePng(file),
              "No signature found in that image. Try a photo of dark ink on white paper.",
            );
          } catch (err) {
            console.error("Signature upload failed", err);
            setError("That image couldn't be read. Try a PNG or JPEG.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={drawing}
        wide
        title="Draw your signature"
        confirmLabel="Save"
        onCancel={() => {
          setDrawing(false);
          setPadHasInk(false);
        }}
        onConfirm={async () => {
          const png = await pad.current?.toPng();
          setDrawing(false);
          setPadHasInk(false);
          await save(png ?? null, "Nothing was drawn.");
        }}
      >
        {drawing && (
          <>
            <p className="muted">
              Sign with Apple Pencil or your finger above the line.
            </p>
            <SignaturePad ref={pad} onChange={setPadHasInk} />
            <p className="button-row">
              <button
                type="button"
                disabled={!padHasInk}
                onClick={() => pad.current?.clear()}
              >
                Clear
              </button>
            </p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
