import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open','');
    document.body.style.overflow = 'hidden';
    return () => { if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, [open]);
  if (!open) return null;
  return <dialog ref={ref} className="sheet" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); closeRef.current(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}><div className="grab" /><div className="section-heading"><h2 className="h-sec" id={titleId}>{title}</h2><button className="icon-btn" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><Icon name="close" /></button></div>{children}</dialog>;
}
