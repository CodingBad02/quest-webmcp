import { hasWebMCP, useRack, type RackItem } from '../webmcp/registry';
import { useAppState } from '../state/store';

const LOCKED: Record<string, { after: string; when: string }> = {
  'check-contribution': { after: 'open-quest', when: 'Unlocks when a quest is open' },
  'submit-contribution': { after: 'check-contribution', when: 'Unlocks after check-contribution passes' },
};

const LABEL: Record<string, string> = {
  'find-quests': 'Match quests to time and skills',
  'open-quest': 'Open a quest workspace',
  'check-contribution': 'Check the form. Say what to fix',
  'submit-contribution': 'Send to a reviewer. Waits for your click',
  'approve-contribution': 'Approve one submission. Light a star',
};

function Item({ r }: { r: RackItem }) {
  return (
    <li className={`tool tool-${r.status}`} tabIndex={0} aria-label={`${r.name}: ${r.status}`}>
      <span className="tool-dot" aria-hidden="true" />
      <div className="tool-body">
        <div className="tool-row">
          <code className="tool-name">{r.name}</code>
          {r.status === 'new' && <span className="tool-tag">New</span>}
        </div>
        <span className="tool-desc">{r.status === 'executing' ? 'Running…' : r.status === 'removing' ? 'No longer needed' : LABEL[r.name] ?? r.description}</span>
      </div>
    </li>
  );
}

export function CapabilityRack() {
  const rack = useRack();
  const role = useAppState((s) => s.role);
  const live = new Set(rack.map((r) => r.name));
  const locked = role === 'volunteer' ? Object.entries(LOCKED).filter(([n]) => !live.has(n)) : [];
  const empty = role === 'reviewer' && rack.length === 0;

  return (
    <div className="rack">
      <div className="rack-head">
        <h2>What the agent can do now</h2>
        <span className="rack-count">{rack.filter((r) => r.status !== 'removing').length}</span>
      </div>
      <p className="rack-sub">
        {hasWebMCP ? 'Tools registered with the browser. They appear when the page state allows them.' : 'WebMCP is off in this browser. The same actions work from the buttons.'}
      </p>
      <ul className="rack-list">
        {rack.map((r) => <Item key={r.name} r={r} />)}
        {locked.map(([name, l]) => (
          <li key={name} className="tool tool-locked" tabIndex={0} aria-label={`${name}: locked. ${l.when}`}>
            <span className="tool-dot" aria-hidden="true" />
            <div className="tool-body">
              <div className="tool-row">
                <code className="tool-name">{name}</code>
                <svg className="tool-lock" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2Zm-8-2a3 3 0 0 1 6 0v2H9V7Z" /></svg>
              </div>
              <span className="tool-desc">{l.when}</span>
            </div>
          </li>
        ))}
        {empty && <li className="tool tool-empty">approve-contribution appears when something is waiting for review.</li>}
      </ul>
    </div>
  );
}
