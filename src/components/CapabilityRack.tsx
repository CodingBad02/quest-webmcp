import { useEffect, useState } from 'react';
import { runtimeDescription, useRack, type RackItem } from '../webmcp/registry';
import { lockedToolsForState, type LockedTool } from '../webmcp/tools';
import { useAppState } from '../state/store';

const LABEL: Record<string, string> = {
  'find-quests': 'Matches quests to your time and skills.',
  'open-quest': 'Opens a quest workspace.',
  'check-contribution': 'Checks the form. Says what to fix.',
  'submit-contribution': 'Sends to a reviewer. Waits for your click.',
  'approve-contribution': 'Approves one submission. Lights a star.',
};

const TAG: Record<string, string> = { new: 'New', executing: 'Running' };

function Item({ r }: { r: RackItem }) {
  const tag = TAG[r.status];
  const desc = r.status === 'removing' ? 'No longer needed.' : r.status === 'executing' ? `Running ${r.name}…` : LABEL[r.name] ?? r.description;
  return (
    <li className="qt-tool" data-state={r.status} tabIndex={0} aria-label={`${r.name}: ${r.status}`}>
      <span className="qt-tool-dot" aria-hidden="true" />
      <span className="qt-tool-name">{r.name}</span>
      {tag && <span className="qt-tool-tag">{tag}</span>}
      <span className="qt-tool-desc">{desc}</span>
    </li>
  );
}

function LockedItem({ l }: { l: LockedTool }) {
  return (
    <li className="qt-tool" data-state="locked" tabIndex={0} aria-label={`${l.name}: locked. ${l.reason}`}>
      <span className="qt-tool-dot" aria-hidden="true" />
      <span className="qt-tool-name">{l.name}</span>
      <span className="qt-tool-desc">{l.reason}</span>
    </li>
  );
}

export function CapabilityRack() {
  const [open, setOpen] = useState(false);
  const rack = useRack();
  const state = useAppState((s) => s);
  const live = new Set(rack.map((r) => r.name));
  const locked = lockedToolsForState(state).filter((l) => !live.has(l.name));
  const count = rack.filter((r) => r.status !== 'removing').length;
  const empty = rack.length === 0 && locked.length === 0;
  const emptyMessage = state.role === 'reviewer' ? 'approve-contribution appears when something is waiting for review.' : 'No tools right now.';

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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <h2 className="qt-rack-title">Tools available now</h2>
        <p className="qt-rack-runtime">{runtimeDescription()}</p>
        <ul className="qt-rack-list" aria-live="polite">
          {rack.map((r) => <Item key={r.name} r={r} />)}
          {locked.map((l) => <LockedItem key={l.name} l={l} />)}
        </ul>
        <p className="qt-rack-empty" hidden={!empty}>{emptyMessage}</p>
      </aside>
    </>
  );
}
