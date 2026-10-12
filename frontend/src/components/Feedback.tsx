import { useEffect, type CSSProperties, type ReactNode } from "react";

import styles from "./Feedback.module.css";

export function FullPageLoader({ label }: { label: string }) {
  return (
    <div className={styles.center} role="status" aria-live="polite">
      <div>
        <div className={styles.spinner} aria-hidden="true" style={{ margin: "0 auto" }} />
        <p className={styles.loaderLabel}>{label}</p>
      </div>
    </div>
  );
}

interface StatePanelProps {
  title: string;
  message?: ReactNode;
  actions?: ReactNode;
  role?: "alert" | "status";
}

export function StatePanel({ title, message, actions, role }: StatePanelProps) {
  return (
    <section className={styles.panel} role={role}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {message && <p className={styles.panelMessage}>{message}</p>}
      {actions && <div className={styles.panelActions}>{actions}</div>}
    </section>
  );
}

type Tone = "error" | "success" | "info" | "warning";

interface AlertProps {
  tone: Tone;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** Inline message. Errors are announced assertively; others politely. */
export function Alert({ tone, children, onDismiss, className }: AlertProps) {
  return (
    <div
      className={[styles.alert, styles[tone], className ?? ""].join(" ")}
      role={tone === "error" ? "alert" : "status"}
    >
      <div>{children}</div>
      {onDismiss && (
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss message">
          ×
        </button>
      )}
    </div>
  );
}

interface ToastProps {
  message: string | null;
  tone?: Tone;
  onDismiss: () => void;
  autoHideMs?: number;
}

/** Transient notification. The live region stays mounted so updates are announced. */
export function Toast({ message, tone = "success", onDismiss, autoHideMs = 6000 }: ToastProps) {
  useEffect(() => {
    if (!message || !autoHideMs) return;
    const id = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(id);
  }, [message, autoHideMs, onDismiss]);

  return (
    <div className={styles.toastRegion}>
      {message && (
        <Alert tone={tone} onDismiss={onDismiss}>
          {message}
        </Alert>
      )}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14, style }: { width?: CSSProperties["width"]; height?: number; style?: CSSProperties }) {
  return <span className={styles.skeleton} style={{ width, height, ...style }} aria-hidden="true" />;
}
