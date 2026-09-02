import { useEffect, useRef } from 'react';
import { activeQuest, useAppState } from '../state/store';
import { resolveConfirm } from '../webmcp/tools';

export function ConfirmModal() {
  const open = useAppState((s) => s.confirmOpen);
  const q = useAppState(() => activeQuest());
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="confirm" aria-labelledby="confirm-title" onCancel={(e) => { e.preventDefault(); resolveConfirm(false); }}>
      <p className="eyebrow">Your agent asked to submit</p>
      <h2 id="confirm-title">Send this to a reviewer?</h2>
      <p className="body">{q ? <>Your work on <strong>{q.placeName}</strong> goes to a person who checks it before it is used.</> : 'A person will check your answer before it is used.'} You can edit it again if it is sent back.</p>
      <div className="actions">
        <button className="btn" onClick={() => resolveConfirm(false)}>Keep editing</button>
        <button className="btn primary" autoFocus onClick={() => resolveConfirm(true)}>Send for review</button>
      </div>
    </dialog>
  );
}
