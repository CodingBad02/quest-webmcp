import { Fragment, useEffect, useRef } from 'react';
import { useAppState } from '../state/store';
import { resolveConfirm } from '../webmcp/tools';
import type { ContributionPayload } from '../types';

/** Both quest types today are OSM adapters (DESIGN.md §6). */
const LICENSE = 'Open Database License (ODbL)';

/** DESIGN.md §6: untrusted or free-text content in the summary is a plain text node, capped. */
function cap(s: string, max = 120) {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const CHECKED_BY_LABEL: Record<string, string> = { phone: 'Phone call', visit: 'In-person visit', website: 'Website', '': 'Not stated' };
const WHEELCHAIR_LABEL: Record<string, string> = { yes: 'Yes', limited: 'Limited', no: 'No', '': 'Not stated' };

function summaryFields(payload: ContributionPayload): [string, string][] {
  if (payload.kind === 'verify-hours') {
    return [
      ['Opening hours', payload.openingHours || 'Not stated'],
      ['Checked by', CHECKED_BY_LABEL[payload.verifiedBy]],
    ];
  }
  const fields: [string, string][] = [['Wheelchair access', WHEELCHAIR_LABEL[payload.wheelchair]]];
  if (payload.note.trim()) fields.push(['Note', cap(payload.note)]);
  return fields;
}

export function ConfirmModal() {
  const open = useAppState((s) => s.confirmOpen);
  const draft = useAppState((s) => s.draft);
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { returnFocus.current = document.activeElement as HTMLElement | null; d.showModal(); }
    if (!open && d.open) { d.close(); returnFocus.current?.focus(); }
  }, [open]);

  const fields = draft ? summaryFields(draft) : [];

  return (
    <dialog ref={ref} className="qt qt-confirm" aria-labelledby="qt-confirm-title" onCancel={(e) => { e.preventDefault(); resolveConfirm(false); }}>
      <h2 className="qt-confirm-title" id="qt-confirm-title">Send this to a reviewer?</h2>
      <dl className="qt-confirm-summary">
        {fields.map(([k, v]) => (
          <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>
        ))}
      </dl>
      <dl className="qt-confirm-meta">
        <dt>Destination</dt><dd>Quest&rsquo;s review queue</dd>
        <dt>Visibility</dt><dd>Held for review. Not public yet.</dd>
        <dt>License</dt><dd>{LICENSE}</dd>
      </dl>
      <p className="qt-confirm-body">A person checks this before it changes anything public. You can edit it again if it&rsquo;s sent back.</p>
      <p className="qt-confirm-note">This closes on its own if you wait 90 seconds. Nothing is sent until you choose.</p>
      <div className="qt-confirm-actions">
        <button className="qt-btn" value="cancel" autoFocus onClick={() => resolveConfirm(false)}>Keep editing</button>
        <button className="qt-btn qt-btn-primary" value="confirm" onClick={() => resolveConfirm(true)}>Send for review</button>
      </div>
    </dialog>
  );
}
