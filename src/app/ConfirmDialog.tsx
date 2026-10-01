import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal confirmation using the native <dialog> element. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <div>{children}</div>
      <p className="button-row dialog-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={danger ? "danger" : undefined}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </p>
    </dialog>
  );
}
