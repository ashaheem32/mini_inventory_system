import type { ReactNode } from "react";

import styles from "./Field.module.css";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (describedBy: string | undefined) => ReactNode;
}

/** Label + control + hint/error, wired with aria-describedby. */
export function Field({ id, label, error, hint, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children(describedBy)}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
