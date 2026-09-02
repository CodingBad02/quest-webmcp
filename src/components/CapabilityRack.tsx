import { useEffect, useState, useSyncExternalStore } from 'react';
import type { RackItem } from '@gatherlight/quest-tools';
import { controller } from '../webmcp/tools';
import { useAppState } from '../state/store';

const TAG: Partial<Record<RackItem['status'], string>> = { new: 'New', executing: 'Running' };

function describe(r: RackItem): string {
  if (r.status === 'locked') return r.reason ?? 'Locked.';
  if (r.status === 'removing') return 'No longer needed.';
  if (r.status === 'executing') return `Running ${r.name}…`;
  return r.description;
}

function Item({ r }: { r: RackItem }) {
  const tag = TAG[r.status];
  return (
    <li className="qt-tool" data-state={r.status} tabIndex={0} aria-label={`${r.name}: ${r.status}${r.reason ? `. ${r.reason}` : ''}`}>
      <span className="qt-tool-dot" aria-hidden="true" />
      <span className="qt-tool-name">{r.name}</span>
      {tag && <span className="qt-tool-tag">{tag}</span>}
      <span className="qt-tool-desc">{describe(r)}</span>
    </li>
  );
}

export function CapabilityRack() {
  const [open, setOpen] = useState(false);
  const rack = useSyncExternalStore(controller.subscribe, controller.getRack, controller.getRack);
  const role = useAppState((s) => s.role);
  const count = rack.filter((r) => r.status !== 'removing' && r.status !== 'locked').length;
  const empty = rack.length === 0;
  const emptyMessage = role === 'reviewer' ? 'approve-contribution appears when something is waiting for review.' : 'No tools right now.';

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <>
      <button className="rack-trigger" type="button" aria-expanded={open} aria-controls="capability-rack" onClick={() => setOpen(true)}>
        {count} {count === 1 ? 'tool' : 'tools'} ready
      </button>
      <button className={`rack-backdrop ${open ? 'open' : ''}`} type="button" aria-label="Close agent tools" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
      <aside id="capability-rack" className={`qt qt-rack rack ${open ? 'rack-open' : ''}`} aria-label="Agent tools">
        <button className="rack-close" type="button" aria-label="Close agent tools" onClick={() => setOpen(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <h2 className="qt-rack-title">Tools available now</h2>
        <p className="qt-rack-runtime">{controller.runtime()}</p>
        <ul className="qt-rack-list" aria-live="polite">
          {rack.map((r) => <Item key={r.name} r={r} />)}
        </ul>
        <p className="qt-rack-empty" hidden={!empty}>{emptyMessage}</p>
      </aside>
    </>
  );
}
