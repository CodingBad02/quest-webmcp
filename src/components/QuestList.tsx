import { openQuest, useAppState } from '../state/store';
import { findQuestsImpl } from '../webmcp/tools';
import type { JSX } from 'react';
import type { Quest, QuestType } from '../types';

const ICON: Record<QuestType, JSX.Element> = {
  // Handset: confirm hours by calling.
  'verify-hours': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h3.5l1.5 4-2.2 1.5a10 10 0 0 0 6.7 6.7L16 14l4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z" /></svg>,
  // Doorway with a level threshold: step-free entry.
  'access-photo': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14" /><path d="M3 20h18" /><circle cx="14.5" cy="12" r=".9" fill="currentColor" /></svg>,
  // Text lines that get shorter: a plain rewrite.
  'plain-rewrite': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 11h12M4 16h8" /></svg>,
};
const KIND: Record<QuestType, string> = { 'verify-hours': 'Confirm hours', 'access-photo': 'Step-free entry', 'plain-rewrite': 'Plain rewrite' };

function Card({ q }: { q: Quest }) {
  return (
    <li>
      <button className="card" onClick={() => openQuest(q.id)}>
        <span className={`card-glyph kind-${q.type}`} aria-hidden="true">{ICON[q.type]}</span>
        <span className={`kind kind-${q.type}`}>{KIND[q.type]}</span>
        <strong className="card-title">{q.placeName}</strong>
        <span className="card-meta">
          about {q.estimatedMinutes} min · {q.remote ? 'from home' : 'in person'}{q.address ? ` · ${q.address}` : ''}
        </span>
      </button>
    </li>
  );
}

export function QuestList() {
  const quests = useAppState((s) => s.quests);
  const profile = useAppState((s) => s.profile);
  const contributions = useAppState((s) => s.contributions);
  const source = useAppState((s) => s.questSource);
  const matches = findQuestsImpl({});
  const mine = contributions.filter((c) => c.volunteerName === (profile.name || 'A volunteer'));

  if (source === 'loading') return <div className="empty">Loading real places from OpenStreetMap…</div>;

  return (
    <div className="questlist">
      <div className="section-head">
        <h1>Quests that fit {profile.minutesAvailable} minutes</h1>
        <p className="muted">Each one fixes a real gap in the public map, or makes one help page easier to read. Ask your browser agent, or pick one.</p>
      </div>
      {matches.length === 0 ? (
        <div className="empty">No quests match right now. Try more minutes, or tick another skill.</div>
      ) : (
        <ul className="cards">{matches.map((q) => <Card key={q.id} q={q} />)}</ul>
      )}
      {mine.length > 0 && (
        <div className="mine">
          <h2>Your contributions</h2>
          <ul>
            {mine.map((c) => (
              <li key={c.id} className={`mine-item status-${c.status}`}>
                <span className="status">{c.status}</span> {c.questTitle}
                {c.reviewComment && <span className="muted"> · {c.reviewComment}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted small">{quests.length} open quests in central Bengaluru. Showing the five that fit you best.</p>
    </div>
  );
}
