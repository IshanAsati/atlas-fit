import { useEffect, useId, useRef, type ReactNode } from 'react';
import { REPDB_URL } from '../data/repdb';

export function TopBar({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="row between">
        <div>
          <h1>{title}</h1>
          {sub ? <p>{sub}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}

/** Native modal: traps focus, makes the background inert and restores focus. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;
  return (
      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          )).filter((element) => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onCancel={(event) => { event.preventDefault(); onClose(); }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right ||
              event.clientY < rect.top || event.clientY > rect.bottom) onClose();
        }}
      >
        <div className="grab" aria-hidden="true" />
        <div className="row between sheet-heading">
          <h2 id={titleId} className="h-sec">{title ?? 'Details'}</h2>
          <button type="button" className="btn ghost small-btn" onClick={onClose}>Close</button>
        </div>
        {children}
      </dialog>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 6 }}>{title}</strong>
      {body}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

/** Section header: condensed title + trailing action (single-column rhythm). */
export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="h-sec">{title}</h2>
      {action}
    </div>
  );
}

/** Shimmer placeholder for async states — never a frozen blank screen. */
export function Skeleton({ height = 20, label }: { height?: number; label: string }) {
  return <div className="skeleton" style={{ height }} role="status" aria-label={label} />;
}

/** Required visible attribution for the RepDB Free dataset (§6.1). */
export function Credit() {
  return (
    <p className="credit">
      Exercise data by{' '}
      <a href={REPDB_URL} target="_blank" rel="noreferrer noopener">
        RepDB (repdb.co)
      </a>
      . Atlas Fit is a personal, offline-first app — your logs stay on this device.
    </p>
  );
}

export const TARGET_LEGEND = (
  <div className="legend">
    <span>
      <i style={{ background: 'var(--muscle-primary)' }} /> Primary
    </span>
    <span>
      <i style={{ background: 'var(--muscle-secondary)' }} /> Secondary
    </span>
    <span>
      <i style={{ background: 'var(--muscle-neutral)' }} /> Not targeted
    </span>
  </div>
);

export const ACTIVITY_LEGEND = (
  <div className="legend">
    <span className="small" style={{ width: '100%' }}>Training activity estimate (logged working sets)</span>
    <span>
      <i style={{ background: '#dad7e8' }} /> 0
    </span>
    <span>
      <i style={{ background: '#f6a9b1' }} /> 1–2
    </span>
    <span>
      <i style={{ background: '#f47482' }} /> 3–5
    </span>
    <span>
      <i style={{ background: '#f04455' }} /> 6–8
    </span>
    <span>
      <i style={{ background: '#c92c3e' }} /> 9+
    </span>
  </div>
);
