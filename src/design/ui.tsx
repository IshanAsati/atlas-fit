import { useEffect, type ReactNode } from 'react';
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

/** Bottom sheet with scrim, ESC-to-close and focusable content. */
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title ?? 'Details'}>
        <div className="grab" aria-hidden="true" />
        {title ? <h2 className="h-sec" style={{ margin: '0 0 10px' }}>{title}</h2> : null}
        {children}
      </div>
    </>
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
