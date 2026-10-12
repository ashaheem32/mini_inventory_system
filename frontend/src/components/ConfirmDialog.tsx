import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "./Button";
import styles from "./ConfirmDialog.module.css";
import { Alert } from "./Feedback";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** Element to focus after closing; defaults to whatever had focus when opened. */
  returnFocusTo?: () => HTMLElement | null;
}

/**
 * Modal confirmation built on <dialog>: the browser provides focus containment,
 * Escape handling and an inert background.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  onConfirm,
  onCancel,
  returnFocusTo,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef(returnFocusTo);
  returnFocusRef.current = returnFocusTo;
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    if (!open && openerRef.current !== null) {
      const fallback = openerRef.current;
      openerRef.current = null;
      const target = returnFocusRef.current?.() ?? (fallback.isConnected ? fallback : null);
      target?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        // Escape key: close unless a request is in flight.
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      {open && (
        <div className={styles.body}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <div id={descriptionId} className={styles.description}>
            {description}
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <div className={styles.actions}>
            <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm} disabled={pending} aria-busy={pending}>
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
