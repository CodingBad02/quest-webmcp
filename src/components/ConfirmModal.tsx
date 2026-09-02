import { useEffect, useRef } from 'react';
import { useAppState } from '../state/store';
import { resolveConfirm } from '../webmcp/tools';

export function ConfirmModal() {
  const open = useAppState((s) => s.confirmOpen);
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { returnFocus.current = document.activeElement as HTMLElement | null; d.showModal(); }
    if (!open && d.open) { d.close(); returnFocus.current?.focus(); }
  }, [open]);

  return (
    <dialog ref={ref} className="confirm" aria-labelledby="confirm-title" onCancel={(e) => { e.preventDefault(); resolveConfirm(false); }}>
      <h2 id="confirm-title">Send this to a reviewer?</h2>
      <p className="body">A person will check your answer before it's used. You can still edit it after sending if it's sent back.</p>
      <div className="actions">
        <button className="btn" autoFocus onClick={() => resolveConfirm(false)}>Keep editing</button>
        <button className="btn primary" onClick={() => resolveConfirm(true)}>Send for review</button>
      </div>
    </dialog>
  );
}
